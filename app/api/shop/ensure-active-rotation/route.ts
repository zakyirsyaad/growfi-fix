import { BN, Program, type Idl } from "@coral-xyz/anchor";
import bs58 from "bs58";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";
import idl from "@/lib/idl/growfi_core.json";
import { getCurrentUser } from "@/lib/auth/server";
import { assertDevnetServerFeatureEnabled } from "@/lib/env/solana";
import { GameError } from "@/lib/game/errors";
import { ONCHAIN_SEEDS } from "@/lib/solana/growfiData";
import {
  createGrowfiAnchorProvider,
  createGrowfiConnection,
  getGrowfiCoreProgramId,
  growfiPdas,
  type AnchorWalletLike,
} from "@/lib/solana/growfiCore";
import { handleApiError, ok } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";

type AccountClient<TAccount = unknown> = {
  fetch(address: PublicKey): Promise<TAccount>;
  fetchNullable?: (address: PublicKey) => Promise<TAccount | null>;
  all?: () => Promise<Array<{ publicKey: PublicKey; account: TAccount }>>;
};
type AccountClients = Record<string, AccountClient>;
type ShopRotationAccount = {
  rotationId: BN;
  startsAt: BN;
  endsAt: BN;
};
type ShopItemAccount = {
  rotationId: BN;
  seedId: BN;
};
type ConfigAccount = {
  admin: PublicKey;
};

const SHOP_STOCK_BY_RARITY: Record<
  string,
  { stockTotal: number; maxBuyPerUser: number }
> = {
  COMMON: { stockTotal: 100, maxBuyPerUser: 20 },
  UNCOMMON: { stockTotal: 60, maxBuyPerUser: 12 },
  RARE: { stockTotal: 25, maxBuyPerUser: 6 },
  EPIC: { stockTotal: 10, maxBuyPerUser: 3 },
  LEGENDARY: { stockTotal: 4, maxBuyPerUser: 1 },
  MYTHIC: { stockTotal: 2, maxBuyPerUser: 1 },
};

function parseSecretKey(secret: string) {
  try {
    const parsed = JSON.parse(secret) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch {
    return Keypair.fromSecretKey(bs58.decode(secret));
  }
}

function loadAdminKeypair() {
  const secret =
    process.env.GROWFI_ADMIN_SECRET_KEY ||
    process.env.TREASURY_WALLET_SECRET_KEY ||
    process.env.TREASURY_WALLET_PRIVATE_KEY;
  if (!secret) {
    throw new GameError(
      "No devnet admin signer is configured. Set GROWFI_ADMIN_SECRET_KEY or TREASURY_WALLET_SECRET_KEY to auto-create shop rotations.",
      503
    );
  }
  return parseSecretKey(secret);
}

function walletFromKeypair(keypair: Keypair): AnchorWalletLike {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T extends Transaction | VersionedTransaction>(
      transaction: T
    ) => {
      if (transaction instanceof Transaction) {
        transaction.partialSign(keypair);
      } else {
        transaction.sign([keypair]);
      }
      return transaction;
    },
    signAllTransactions: async <T extends Transaction | VersionedTransaction>(
      transactions: T[]
    ) => {
      return Promise.all(
        transactions.map((transaction) =>
          walletFromKeypair(keypair).signTransaction(transaction)
        )
      );
    },
  };
}

function assertDevnetAutomationAllowed() {
  assertDevnetServerFeatureEnabled({
    flagName: "ENABLE_DEVNET_SHOP_AUTOMATION",
    featureName: "Shop auto-creation",
  });
}

function bnToNumber(value: unknown) {
  if (value instanceof BN) {
    return (value as BN).toNumber();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    return Number((value as { toNumber: () => number }).toNumber());
  }
  return Number(value || 0);
}

async function fetchNullable<T>(
  program: Program<Idl>,
  accountName: string,
  address: PublicKey
) {
  const accountClient = (program.account as unknown as AccountClients)[
    accountName
  ] as AccountClient<T> | undefined;
  if (!accountClient) {
    throw new Error(`Missing account client ${accountName}.`);
  }
  if (accountClient.fetchNullable) {
    return accountClient.fetchNullable(address);
  }
  try {
    return await accountClient.fetch(address);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Account does not exist|not found|AccountNotFound/i.test(message)) {
      return null;
    }
    throw error;
  }
}

async function findActiveRotation(program: Program<Idl>, now: number) {
  const client = (program.account as unknown as AccountClients)
    .shopRotation as AccountClient<ShopRotationAccount>;
  if (!client.all) {
    throw new Error("GrowFi IDL cannot list shop rotations.");
  }
  const rotations = await client.all();
  return rotations
    .map((entry) => ({
      publicKey: entry.publicKey,
      rotationId: bnToNumber(entry.account.rotationId),
      startsAt: bnToNumber(entry.account.startsAt),
      endsAt: bnToNumber(entry.account.endsAt),
    }))
    .filter((entry) => entry.startsAt <= now && entry.endsAt > now)
    .sort((a, b) => b.startsAt - a.startsAt)[0];
}

function growPriceBn(price: number) {
  const decimals = Number(process.env.GROW_TOKEN_DECIMALS || 9);
  const raw = BigInt(price) * BigInt(10) ** BigInt(decimals);
  return new BN(raw.toString());
}

async function ensureActiveShopRotation() {
  assertDevnetAutomationAllowed();
  const admin = loadAdminKeypair();
  const connection = createGrowfiConnection("confirmed");
  const provider = createGrowfiAnchorProvider(
    connection,
    walletFromKeypair(admin),
    "confirmed"
  );
  const programId = getGrowfiCoreProgramId();
  const program = new Program(
    { ...(idl as Idl), address: programId.toBase58() },
    provider
  );
  const now = Math.floor(Date.now() / 1000);
  const active = await findActiveRotation(program, now);
  const [config] = growfiPdas.config(programId);
  const configAccount = await fetchNullable<ConfigAccount>(
    program,
    "config",
    config
  );
  if (!configAccount) {
    throw new GameError("GrowFi Config PDA is missing on devnet.", 503);
  }
  if (!configAccount.admin.equals(admin.publicKey)) {
    throw new GameError(
      "Configured shop admin signer does not match the on-chain GrowFi admin.",
      403
    );
  }

  if (active) {
    return {
      created: false,
      rotationId: active.rotationId,
      startsAt: active.startsAt,
      endsAt: active.endsAt,
      itemSignatures: [] as string[],
      rotationSignature: null as string | null,
      seedCatalogCount: ONCHAIN_SEEDS.length,
    };
  }

  const rotationId = Number(process.env.SHOP_ROTATION_ID || now);
  const durationSeconds = Number(process.env.SHOP_ROTATION_SECONDS || 86_400);
  const startsAt = now - 5;
  const endsAt = now + durationSeconds;
  const [shopRotation] = growfiPdas.shopRotation(rotationId, programId);
  const rotationSignature = await program.methods
    .createShopRotation(new BN(rotationId), new BN(startsAt), new BN(endsAt))
    .accounts({
      config,
      shopRotation,
      admin: admin.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  const itemSignatures: string[] = [];
  let seedCatalogCount = 0;
  for (const seed of ONCHAIN_SEEDS) {
    const [seedCatalog] = growfiPdas.seedCatalog(seed.seedId, programId);
    const [shopItem] = growfiPdas.shopItem(
      rotationId,
      seed.seedId,
      programId
    );
    const seedAccount = await fetchNullable(program, "seedCatalog", seedCatalog);
    if (!seedAccount) {
      continue;
    }
    seedCatalogCount += 1;
    const existing = await fetchNullable<ShopItemAccount>(
      program,
      "shopItem",
      shopItem
    );
    if (existing) {
      continue;
    }
    const stock = SHOP_STOCK_BY_RARITY[seed.rarity];
    const signature = await program.methods
      .createShopItem(
        new BN(rotationId),
        new BN(seed.seedId),
        growPriceBn(seed.price),
        new BN(stock.stockTotal),
        new BN(stock.maxBuyPerUser)
      )
      .accounts({
        config,
        shopRotation,
        seedCatalog,
        shopItem,
        admin: admin.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    itemSignatures.push(signature);
  }

  if (seedCatalogCount === 0) {
    throw new GameError(
      "No on-chain SeedCatalog accounts were found. Run anchor/scripts/seed-catalog.ts first.",
      503
    );
  }

  return {
    created: true,
    rotationId,
    startsAt,
    endsAt,
    rotationSignature,
    itemSignatures,
    seedCatalogCount,
  };
}

export async function POST() {
  try {
    const user = await getCurrentUser();
    await rateLimit(`shop-ensure:${user.id}`, 10, 60_000);
    const result = await ensureActiveShopRotation();
    console.debug("[GrowFi] ensure-active-rotation", {
      currentUnixTime: Math.floor(Date.now() / 1000),
      activeRotationId: result.rotationId,
      startsAt: result.startsAt,
      endsAt: result.endsAt,
      created: result.created,
      shopItemsCreated: result.itemSignatures.length,
      seedCatalogCount: result.seedCatalogCount,
    });
    return ok(result);
  } catch (error) {
    return handleApiError(error);
  }
}
