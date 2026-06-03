import {
  AnchorProvider,
  BN,
  Program,
  type Idl,
  type Provider,
} from "@coral-xyz/anchor";
import {
  Commitment,
  Connection,
  PublicKey,
  Transaction,
  VersionedTransaction,
} from "@solana/web3.js";

export const DEFAULT_GROWFI_CORE_PROGRAM_ID =
  "ESiJ1Fk5b9X8GitSjNW44LzRNBWByrHa7kkEWsTPmDYz";

export type AnchorWalletLike = {
  publicKey: PublicKey;
  signTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T
  ): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ): Promise<T[]>;
};

type SeedNumber = number | bigint | BN;

const encoder = new TextEncoder();

function textSeed(value: string) {
  return encoder.encode(value);
}

function toBn(value: SeedNumber) {
  return value instanceof BN ? value : new BN(value.toString());
}

function u64Le(value: SeedNumber) {
  return toBn(value).toArrayLike(Uint8Array, "le", 8);
}

function u16Le(value: number) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

export function getGrowfiCoreProgramId() {
  return new PublicKey(
    process.env.NEXT_PUBLIC_GROWFI_PROGRAM_ID ||
      process.env.NEXT_PUBLIC_GROWFI_CORE_PROGRAM_ID ||
      process.env.GROWFI_PROGRAM_ID ||
      process.env.GROWFI_CORE_PROGRAM_ID ||
      DEFAULT_GROWFI_CORE_PROGRAM_ID
  );
}

export function getGrowTokenMint() {
  const mint =
    process.env.NEXT_PUBLIC_GROW_TOKEN_MINT || process.env.GROW_TOKEN_MINT;
  return mint ? new PublicKey(mint) : null;
}

export function createGrowfiConnection(commitment: Commitment = "confirmed") {
  return new Connection(
    process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
      process.env.SOLANA_RPC_URL ||
      "https://api.devnet.solana.com",
    commitment
  );
}

export function createGrowfiAnchorProvider(
  connection: Connection,
  wallet: AnchorWalletLike,
  commitment: Commitment = "confirmed"
) {
  return new AnchorProvider(connection, wallet, {
    commitment,
    preflightCommitment: commitment,
  });
}

export function createGrowfiProgram<TIdl extends Idl>(
  idl: TIdl,
  provider: Provider,
  programId = getGrowfiCoreProgramId()
) {
  return new Program({ ...idl, address: programId.toBase58() }, provider);
}

export const growfiPdas = {
  config(programId = getGrowfiCoreProgramId()) {
    return PublicKey.findProgramAddressSync([textSeed("config")], programId);
  },
  player(authority: PublicKey, programId = getGrowfiCoreProgramId()) {
    return PublicKey.findProgramAddressSync(
      [textSeed("player"), authority.toBuffer()],
      programId
    );
  },
  farm(owner: PublicKey, programId = getGrowfiCoreProgramId()) {
    return PublicKey.findProgramAddressSync(
      [textSeed("farm"), owner.toBuffer()],
      programId
    );
  },
  plot(
    farm: PublicKey,
    x: number,
    y: number,
    programId = getGrowfiCoreProgramId()
  ) {
    return PublicKey.findProgramAddressSync(
      [textSeed("plot"), farm.toBuffer(), u16Le(x), u16Le(y)],
      programId
    );
  },
  seedInventory(owner: PublicKey, programId = getGrowfiCoreProgramId()) {
    return PublicKey.findProgramAddressSync(
      [textSeed("seed_inventory"), owner.toBuffer()],
      programId
    );
  },
  fruitInventory(owner: PublicKey, programId = getGrowfiCoreProgramId()) {
    return PublicKey.findProgramAddressSync(
      [textSeed("fruit_inventory"), owner.toBuffer()],
      programId
    );
  },
  seedCatalog(seedId: SeedNumber, programId = getGrowfiCoreProgramId()) {
    return PublicKey.findProgramAddressSync(
      [textSeed("seed_catalog"), u64Le(seedId)],
      programId
    );
  },
  shopRotation(rotationId: SeedNumber, programId = getGrowfiCoreProgramId()) {
    return PublicKey.findProgramAddressSync(
      [textSeed("shop_rotation"), u64Le(rotationId)],
      programId
    );
  },
  shopItem(
    rotationId: SeedNumber,
    seedId: SeedNumber,
    programId = getGrowfiCoreProgramId()
  ) {
    return PublicKey.findProgramAddressSync(
      [textSeed("shop_item"), u64Le(rotationId), u64Le(seedId)],
      programId
    );
  },
  shopPurchase(
    buyer: PublicKey,
    rotationId: SeedNumber,
    seedId: SeedNumber,
    programId = getGrowfiCoreProgramId()
  ) {
    return PublicKey.findProgramAddressSync(
      [
        textSeed("shop_purchase"),
        buyer.toBuffer(),
        u64Le(rotationId),
        u64Le(seedId),
      ],
      programId
    );
  },
  listing(
    seller: PublicKey,
    listingId: SeedNumber,
    programId = getGrowfiCoreProgramId()
  ) {
    return PublicKey.findProgramAddressSync(
      [textSeed("listing"), seller.toBuffer(), u64Le(listingId)],
      programId
    );
  },
  marketplaceListing(
    seller: PublicKey,
    listingId: SeedNumber,
    programId = getGrowfiCoreProgramId()
  ) {
    return PublicKey.findProgramAddressSync(
      [textSeed("listing"), seller.toBuffer(), u64Le(listingId)],
      programId
    );
  },
  trade(
    initiator: PublicKey,
    recipient: PublicKey,
    tradeId: SeedNumber,
    programId = getGrowfiCoreProgramId()
  ) {
    return PublicKey.findProgramAddressSync(
      [
        textSeed("trade"),
        initiator.toBuffer(),
        recipient.toBuffer(),
        u64Le(tradeId),
      ],
      programId
    );
  },
  creator(owner: PublicKey, programId = getGrowfiCoreProgramId()) {
    return PublicKey.findProgramAddressSync(
      [textSeed("creator"), owner.toBuffer()],
      programId
    );
  },
  decorationInventory(owner: PublicKey, programId = getGrowfiCoreProgramId()) {
    return PublicKey.findProgramAddressSync(
      [textSeed("decoration_inventory"), owner.toBuffer()],
      programId
    );
  },
  decoration(
    farm: PublicKey,
    placementId: SeedNumber,
    programId = getGrowfiCoreProgramId()
  ) {
    return PublicKey.findProgramAddressSync(
      [textSeed("decoration"), farm.toBuffer(), u64Le(placementId)],
      programId
    );
  },
  challenge(
    creator: PublicKey,
    challengeId: SeedNumber,
    programId = getGrowfiCoreProgramId()
  ) {
    return PublicKey.findProgramAddressSync(
      [textSeed("challenge"), creator.toBuffer(), u64Le(challengeId)],
      programId
    );
  },
  challengeProgress(
    challenge: PublicKey,
    player: PublicKey,
    programId = getGrowfiCoreProgramId()
  ) {
    return PublicKey.findProgramAddressSync(
      [textSeed("challenge_progress"), challenge.toBuffer(), player.toBuffer()],
      programId
    );
  },
};
