import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import crypto from "crypto";
import fs from "fs";
import os from "os";
import path from "path";

import idl from "../target/idl/growfi_core.json";

const DEFAULT_RPC_URL = "https://api.devnet.solana.com";
const DEFAULT_WALLET_PATH = "~/.config/solana/phantom-dev.json";
const ANCHOR_TOML = path.resolve(__dirname, "..", "Anchor.toml");
export const GROW_DECIMALS = 9;
export const GROW_BASE_UNITS = BigInt("1000000000");

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) {
    return;
  }
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }
    const separator = line.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (!key || process.env[key] != null) {
      continue;
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(path.resolve(__dirname, "..", "..", ".env"));
loadEnvFile(path.resolve(__dirname, "..", ".env"));

export type GrowfiProgram = anchor.Program;
export type GrowfiProvider = anchor.AnchorProvider;
export type RarityName =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Epic"
  | "Legendary"
  | "Mythic";
type AccountClient<TAccount = unknown> = {
  fetch(address: anchor.web3.PublicKey): Promise<TAccount>;
  fetchNullable?: (address: anchor.web3.PublicKey) => Promise<TAccount | null>;
  all?: () => Promise<
    Array<{ publicKey: anchor.web3.PublicKey; account: TAccount }>
  >;
};
type AccountClients = Record<string, AccountClient>;
type ShopRotationAccount = {
  rotationId: unknown;
  startsAt: unknown;
  endsAt: unknown;
};
type AnchorLikeError = {
  error?: {
    errorCode?: { code?: string; name?: string };
    errorMessage?: string;
  };
  errorCode?: { code?: string; name?: string };
  errorMessage?: string;
};

export type SeedCatalogEntry = {
  seedId: number;
  fruitId: number;
  name: string;
  rarity: RarityName;
  price: number;
  growTimeSeconds: number;
  regrowTimeSeconds: number;
  minYield: number;
  maxYield: number;
  maxHarvests: number;
  mutationChanceBps: number;
  requiredGardenLevel: number;
  baseSellPrice: number;
};

export type ShopStockEntry = {
  stockTotal: number;
  maxBuyPerUser: number;
};

export const SEED_CATALOG: SeedCatalogEntry[] = [
  {
    seedId: 1,
    fruitId: 1,
    name: "Carrot Seed",
    rarity: "Common",
    price: 2,
    growTimeSeconds: 300,
    regrowTimeSeconds: 0,
    minYield: 1,
    maxYield: 3,
    maxHarvests: 1,
    mutationChanceBps: 500,
    requiredGardenLevel: 1,
    baseSellPrice: 2,
  },
  {
    seedId: 2,
    fruitId: 2,
    name: "Tomato Seed",
    rarity: "Common",
    price: 4,
    growTimeSeconds: 600,
    regrowTimeSeconds: 300,
    minYield: 2,
    maxYield: 4,
    maxHarvests: 3,
    mutationChanceBps: 600,
    requiredGardenLevel: 1,
    baseSellPrice: 3,
  },
  {
    seedId: 3,
    fruitId: 3,
    name: "Strawberry Seed",
    rarity: "Uncommon",
    price: 15,
    growTimeSeconds: 1200,
    regrowTimeSeconds: 600,
    minYield: 2,
    maxYield: 5,
    maxHarvests: 5,
    mutationChanceBps: 700,
    requiredGardenLevel: 2,
    baseSellPrice: 7,
  },
  {
    seedId: 4,
    fruitId: 4,
    name: "Blueberry Seed",
    rarity: "Uncommon",
    price: 18,
    growTimeSeconds: 1500,
    regrowTimeSeconds: 720,
    minYield: 3,
    maxYield: 6,
    maxHarvests: 6,
    mutationChanceBps: 750,
    requiredGardenLevel: 2,
    baseSellPrice: 6,
  },
  {
    seedId: 5,
    fruitId: 5,
    name: "Watermelon Seed",
    rarity: "Rare",
    price: 50,
    growTimeSeconds: 3600,
    regrowTimeSeconds: 1800,
    minYield: 1,
    maxYield: 3,
    maxHarvests: 2,
    mutationChanceBps: 900,
    requiredGardenLevel: 3,
    baseSellPrice: 30,
  },
  {
    seedId: 6,
    fruitId: 6,
    name: "Dragon Fruit Seed",
    rarity: "Rare",
    price: 80,
    growTimeSeconds: 5400,
    regrowTimeSeconds: 2700,
    minYield: 1,
    maxYield: 3,
    maxHarvests: 10,
    mutationChanceBps: 1000,
    requiredGardenLevel: 3,
    baseSellPrice: 48,
  },
  {
    seedId: 7,
    fruitId: 7,
    name: "Crystal Apple Seed",
    rarity: "Epic",
    price: 200,
    growTimeSeconds: 10800,
    regrowTimeSeconds: 5400,
    minYield: 1,
    maxYield: 2,
    maxHarvests: 15,
    mutationChanceBps: 1200,
    requiredGardenLevel: 4,
    baseSellPrice: 150,
  },
  {
    seedId: 8,
    fruitId: 8,
    name: "Golden Mango Seed",
    rarity: "Legendary",
    price: 500,
    growTimeSeconds: 21600,
    regrowTimeSeconds: 7200,
    minYield: 1,
    maxYield: 2,
    maxHarvests: 20,
    mutationChanceBps: 1500,
    requiredGardenLevel: 5,
    baseSellPrice: 400,
  },
  {
    seedId: 9,
    fruitId: 9,
    name: "Time Flower Seed",
    rarity: "Mythic",
    price: 1500,
    growTimeSeconds: 43200,
    regrowTimeSeconds: 14400,
    minYield: 1,
    maxYield: 1,
    maxHarvests: 25,
    mutationChanceBps: 2000,
    requiredGardenLevel: 5,
    baseSellPrice: 1300,
  },
];

export const SHOP_STOCK_BY_RARITY: Record<RarityName, ShopStockEntry> = {
  Common: { stockTotal: 100, maxBuyPerUser: 20 },
  Uncommon: { stockTotal: 60, maxBuyPerUser: 12 },
  Rare: { stockTotal: 25, maxBuyPerUser: 6 },
  Epic: { stockTotal: 10, maxBuyPerUser: 3 },
  Legendary: { stockTotal: 4, maxBuyPerUser: 1 },
  Mythic: { stockTotal: 2, maxBuyPerUser: 1 },
};

export function bn(value: number | bigint | string | anchor.BN) {
  return value instanceof anchor.BN ? value : new anchor.BN(value.toString());
}

export function growToBaseUnits(value: number | bigint | string) {
  const text = value.toString();
  const [whole, fraction = ""] = text.split(".");
  if (fraction.length > GROW_DECIMALS) {
    throw new Error(
      `$GROW amount ${text} has more than ${GROW_DECIMALS} decimals.`
    );
  }
  const wholeUnits = BigInt(whole || "0") * GROW_BASE_UNITS;
  const fractionUnits = BigInt(fraction.padEnd(GROW_DECIMALS, "0") || "0");
  return wholeUnits + fractionUnits;
}

export function growBn(value: number | bigint | string) {
  return bn(growToBaseUnits(value).toString());
}

export function growBaseUnitsString(value: number | bigint | string) {
  return growToBaseUnits(value).toString();
}

export function growFromBaseUnits(value: unknown) {
  const units = bnToBigInt(value);
  const whole = units / GROW_BASE_UNITS;
  const fraction = units % GROW_BASE_UNITS;
  if (fraction === BigInt(0)) {
    return whole.toString();
  }
  return `${whole}.${fraction
    .toString()
    .padStart(GROW_DECIMALS, "0")
    .replace(/0+$/, "")}`;
}

export function bnToNumber(value: unknown) {
  if (value instanceof anchor.BN) {
    return value.toNumber();
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "number") {
    return value;
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    return Number((value as { toNumber: () => number }).toNumber());
  }
  return Number(value);
}

export function bnToBigInt(value: unknown) {
  if (value instanceof anchor.BN) {
    return BigInt(value.toString());
  }
  if (typeof value === "bigint") {
    return value;
  }
  if (typeof value === "number") {
    return BigInt(value);
  }
  if (value && typeof value === "object" && "toString" in value) {
    return BigInt((value as { toString: () => string }).toString());
  }
  return BigInt(String(value));
}

export function u64Le(value: number | bigint | string | anchor.BN) {
  return bn(value).toArrayLike(Buffer, "le", 8);
}

export function u16Le(value: number) {
  const bytes = Buffer.alloc(2);
  bytes.writeUInt16LE(value, 0);
  return bytes;
}

export function nameHash(name: string) {
  return Array.from(crypto.createHash("sha256").update(name).digest());
}

export function rarityVariant(rarity: RarityName) {
  return { [rarity.charAt(0).toLowerCase() + rarity.slice(1)]: {} };
}

export function expandHome(filePath: string) {
  if (filePath === "~") {
    return os.homedir();
  }
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

export function readAnchorToml() {
  return fs.existsSync(ANCHOR_TOML) ? fs.readFileSync(ANCHOR_TOML, "utf8") : "";
}

export function readAnchorTomlValue(section: string, key: string) {
  const toml = readAnchorToml();
  const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const sectionMatch = toml.match(
    new RegExp(`\\[${escaped}\\]([\\s\\S]*?)(?=\\n\\[|$)`)
  );
  if (!sectionMatch) {
    return null;
  }
  const keyMatch = sectionMatch[1].match(
    new RegExp(`^\\s*${key}\\s*=\\s*\"([^\"]+)\"`, "m")
  );
  return keyMatch?.[1] ?? null;
}

export function loadProgramId() {
  const fromEnv =
    process.env.GROWFI_PROGRAM_ID ||
    process.env.NEXT_PUBLIC_GROWFI_PROGRAM_ID ||
    process.env.GROWFI_CORE_PROGRAM_ID ||
    process.env.NEXT_PUBLIC_GROWFI_CORE_PROGRAM_ID ||
    process.env.ANCHOR_PROGRAM_ID;
  return new anchor.web3.PublicKey(
    fromEnv ||
      readAnchorTomlValue("programs.devnet", "growfi_core") ||
      idl.address
  );
}

export function loadRpcUrl() {
  const fromEnv =
    process.env.ANCHOR_PROVIDER_URL ||
    process.env.SOLANA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (fromEnv) {
    return fromEnv;
  }
  const cluster = readAnchorTomlValue("provider", "cluster")?.toLowerCase();
  if (cluster === "localnet" || cluster === "local") {
    return "http://127.0.0.1:8899";
  }
  if (cluster === "mainnet" || cluster === "mainnet-beta") {
    return "https://api.mainnet-beta.solana.com";
  }
  return DEFAULT_RPC_URL;
}

export function loadWalletPath() {
  return expandHome(
    process.env.ANCHOR_WALLET ||
      process.env.SOLANA_WALLET ||
      readAnchorTomlValue("provider", "wallet") ||
      DEFAULT_WALLET_PATH
  );
}

export function loadKeypair(filePath = loadWalletPath()) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error(
      `Wallet file ${filePath} must contain a Solana keypair array.`
    );
  }
  return anchor.web3.Keypair.fromSecretKey(Uint8Array.from(raw));
}

export function loadProvider() {
  const walletPath = loadWalletPath();
  const keypair = loadKeypair(walletPath);
  const connection = new anchor.web3.Connection(loadRpcUrl(), {
    commitment: "confirmed",
  });
  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(keypair),
    {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    }
  );
  anchor.setProvider(provider);
  return { provider, walletPath, admin: keypair.publicKey };
}

export function loadProgram(
  provider: GrowfiProvider,
  programId = loadProgramId()
): GrowfiProgram {
  return new anchor.Program(
    { ...(idl as anchor.Idl), address: programId.toBase58() },
    provider
  );
}

export function configPda(programId = loadProgramId()) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    programId
  )[0];
}

export function playerPda(
  authority: anchor.web3.PublicKey,
  programId = loadProgramId()
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("player"), authority.toBuffer()],
    programId
  )[0];
}

export function farmPda(
  owner: anchor.web3.PublicKey,
  programId = loadProgramId()
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("farm"), owner.toBuffer()],
    programId
  )[0];
}

export function plotPda(
  farm: anchor.web3.PublicKey,
  x: number,
  y: number,
  programId = loadProgramId()
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("plot"), farm.toBuffer(), u16Le(x), u16Le(y)],
    programId
  )[0];
}

export function seedInventoryPda(
  owner: anchor.web3.PublicKey,
  programId = loadProgramId()
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("seed_inventory"), owner.toBuffer()],
    programId
  )[0];
}

export function fruitInventoryPda(
  owner: anchor.web3.PublicKey,
  programId = loadProgramId()
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("fruit_inventory"), owner.toBuffer()],
    programId
  )[0];
}

export function decorationInventoryPda(
  owner: anchor.web3.PublicKey,
  programId = loadProgramId()
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("decoration_inventory"), owner.toBuffer()],
    programId
  )[0];
}

export function seedCatalogPda(
  seedId: number | bigint | anchor.BN,
  programId = loadProgramId()
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("seed_catalog"), u64Le(seedId)],
    programId
  )[0];
}

export function shopRotationPda(
  rotationId: number | bigint | anchor.BN,
  programId = loadProgramId()
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("shop_rotation"), u64Le(rotationId)],
    programId
  )[0];
}

export function shopItemPda(
  rotationId: number | bigint | anchor.BN,
  seedId: number | bigint | anchor.BN,
  programId = loadProgramId()
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("shop_item"), u64Le(rotationId), u64Le(seedId)],
    programId
  )[0];
}

export function shopPurchasePda(
  buyer: anchor.web3.PublicKey,
  rotationId: number | bigint | anchor.BN,
  seedId: number | bigint | anchor.BN,
  programId = loadProgramId()
) {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from("shop_purchase"),
      buyer.toBuffer(),
      u64Le(rotationId),
      u64Le(seedId),
    ],
    programId
  )[0];
}

export async function fetchNullable(
  program: GrowfiProgram,
  accountName: string,
  address: anchor.web3.PublicKey
) {
  const client = (program.account as unknown as AccountClients)[accountName];
  if (!client) {
    throw new Error(`IDL has no account client named ${accountName}.`);
  }
  if (client.fetchNullable) {
    return client.fetchNullable(address);
  }
  try {
    return await client.fetch(address);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (
      /Account does not exist|Could not find|AccountNotFound|not found/i.test(
        message
      )
    ) {
      return null;
    }
    throw error;
  }
}

export async function getMintTokenProgram(
  connection: anchor.web3.Connection,
  mint: anchor.web3.PublicKey
) {
  const mintInfo = await connection.getAccountInfo(mint, "confirmed");
  if (!mintInfo) {
    throw new Error(
      `GROW_TOKEN_MINT ${mint.toBase58()} does not exist on devnet.`
    );
  }
  if (
    mintInfo.owner.equals(TOKEN_PROGRAM_ID) ||
    mintInfo.owner.equals(TOKEN_2022_PROGRAM_ID)
  ) {
    return mintInfo.owner;
  }
  throw new Error(
    `Mint ${mint.toBase58()} is owned by ${mintInfo.owner.toBase58()}, not an SPL token program.`
  );
}

export function associatedTokenAddress(
  mint: anchor.web3.PublicKey,
  owner: anchor.web3.PublicKey,
  tokenProgram: anchor.web3.PublicKey
) {
  return getAssociatedTokenAddressSync(
    mint,
    owner,
    true,
    tokenProgram,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

export async function ensureAssociatedTokenAccount(input: {
  provider: GrowfiProvider;
  mint: anchor.web3.PublicKey;
  owner: anchor.web3.PublicKey;
  payer?: anchor.web3.PublicKey;
  tokenProgram: anchor.web3.PublicKey;
}) {
  const payer = input.payer || input.provider.wallet.publicKey;
  const address = associatedTokenAddress(
    input.mint,
    input.owner,
    input.tokenProgram
  );
  const existing = await input.provider.connection.getAccountInfo(
    address,
    "confirmed"
  );
  if (existing) {
    return { address, created: false, signature: null as string | null };
  }

  const transaction = new anchor.web3.Transaction().add(
    createAssociatedTokenAccountInstruction(
      payer,
      address,
      input.owner,
      input.mint,
      input.tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );
  const signature = await input.provider.sendAndConfirm(transaction, [], {
    commitment: "confirmed",
  });
  return { address, created: true, signature };
}

export async function findActiveShopRotation(
  program: GrowfiProgram,
  now = Math.floor(Date.now() / 1000)
) {
  const client = (
    program.account as unknown as Record<
      string,
      AccountClient<ShopRotationAccount>
    >
  ).shopRotation;
  if (!client.all) {
    throw new Error("IDL shopRotation account client cannot list accounts.");
  }
  const rotations = await client.all();
  return rotations
    .map((entry) => ({
      publicKey: entry.publicKey,
      account: entry.account,
      rotationId: bnToNumber(entry.account.rotationId),
      startsAt: bnToNumber(entry.account.startsAt),
      endsAt: bnToNumber(entry.account.endsAt),
    }))
    .filter((entry) => entry.startsAt <= now && entry.endsAt > now)
    .sort((a, b) => b.startsAt - a.startsAt)[0];
}

export function formatExplorer(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function formatUnix(value: unknown) {
  const seconds = bnToNumber(value);
  if (!seconds) {
    return "0";
  }
  return `${seconds} (${new Date(seconds * 1000).toISOString()})`;
}

export function decodeAnchorError(error: unknown) {
  const anchorError = error as AnchorLikeError;
  const code =
    anchorError.error?.errorCode?.code || anchorError.errorCode?.code;
  const message = anchorError.error?.errorMessage || anchorError.errorMessage;
  if (code && message) {
    return `${code}: ${message}`;
  }
  const text = error instanceof Error ? error.message : String(error);
  const hex = text.match(/custom program error: (0x[0-9a-f]+)/i);
  if (hex) {
    const numeric = Number.parseInt(hex[1], 16);
    const idlError = (idl.errors || []).find((entry) => entry.code === numeric);
    if (idlError) {
      return `${idlError.name}: ${idlError.msg}`;
    }
  }
  const decimal = text.match(/custom program error: ([0-9]+)/i);
  if (decimal) {
    const numeric = Number(decimal[1]);
    const idlError = (idl.errors || []).find((entry) => entry.code === numeric);
    if (idlError) {
      return `${idlError.name}: ${idlError.msg}`;
    }
  }
  return text;
}

export function isDecodedError(error: unknown, name: string) {
  return decodeAnchorError(error).startsWith(`${name}:`);
}

export function printPda(label: string, value: anchor.web3.PublicKey) {
  console.log(`${label}: ${value.toBase58()}`);
}

export function parseIntegerEnv(name: string, fallback: number) {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error(`${name} must be a number.`);
  }
  return parsed;
}
