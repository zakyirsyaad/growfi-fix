import "server-only";

import bs58 from "bs58";
import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToCheckedInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint
} from "@solana/spl-token";
import { assertDevnetServerFeatureEnabled } from "@/lib/env/solana";
import { GameError } from "@/lib/game/errors";

export function isMockTokenMode() {
  return process.env.TOKEN_MODE === "mock";
}

export function assertTokenRuntimeConfigured() {
  if (isMockTokenMode()) {
    if (process.env.NODE_ENV === "production") {
      throw new GameError("TOKEN_MODE=mock is not allowed in production.", 500);
    }
    return;
  }

  const missing = [
    "GROW_TOKEN_MINT",
    "TREASURY_WALLET_PUBLIC_KEY",
    "TREASURY_WALLET_SECRET_KEY"
  ].filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new GameError(`Missing token env: ${missing.join(", ")}`, 500);
  }
}

export function getSolanaConnection() {
  return new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
}

function parseTreasuryKeypair() {
  const secret =
    process.env.TREASURY_WALLET_SECRET_KEY ||
    process.env.TREASURY_WALLET_PRIVATE_KEY;
  if (!secret) {
    throw new GameError("Treasury private key is not configured.", 500);
  }

  return parseKeypairSecret(secret);
}

function parseKeypairSecret(secret: string) {
  try {
    const parsed = JSON.parse(secret) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch {
    return Keypair.fromSecretKey(bs58.decode(secret));
  }
}

function parseMintAuthorityKeypair() {
  const secret =
    process.env.MINT_AUTHORITY_SECRET_KEY ||
    process.env.TREASURY_WALLET_SECRET_KEY ||
    process.env.TREASURY_WALLET_PRIVATE_KEY;
  if (!secret) {
    throw new GameError(
      "Devnet mint authority is not configured. Add MINT_AUTHORITY_SECRET_KEY or TREASURY_WALLET_SECRET_KEY on the server.",
      503
    );
  }
  return parseKeypairSecret(secret);
}

function bigintPow10(decimals: number) {
  return BigInt(10) ** BigInt(decimals);
}

async function getMintProgram(connection: Connection, mint: PublicKey) {
  const account = await connection.getAccountInfo(mint, "confirmed");
  if (!account) {
    throw new GameError("Configured $GROW mint was not found on devnet.", 500);
  }
  if (
    account.owner.equals(TOKEN_PROGRAM_ID) ||
    account.owner.equals(TOKEN_2022_PROGRAM_ID)
  ) {
    return account.owner;
  }
  throw new GameError("Configured $GROW mint is not an SPL token mint.", 500);
}

export async function verifyGrowDeposit(params: {
  signature: string;
  userWallet: string;
  amount: number;
}) {
  assertTokenRuntimeConfigured();
  if (isMockTokenMode()) {
    return {
      signature: params.signature,
      rawAmount: BigInt(params.amount),
      mock: true
    };
  }

  const connection = getSolanaConnection();
  const mint = new PublicKey(process.env.GROW_TOKEN_MINT!);
  const treasury = new PublicKey(process.env.TREASURY_WALLET_PUBLIC_KEY!);
  const userWallet = new PublicKey(params.userWallet);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);
  const mintInfo = await getMint(connection, mint);
  const expectedRaw = BigInt(params.amount) * bigintPow10(mintInfo.decimals);

  const tx = await connection.getParsedTransaction(params.signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0
  });

  if (!tx || tx.meta?.err) {
    throw new GameError("Deposit transaction was not found or failed.", 400);
  }

  const outer = tx.transaction.message.instructions;
  const inner = tx.meta?.innerInstructions?.flatMap((item) => item.instructions) || [];
  const instructions = [...outer, ...inner];
  const matched = instructions.some((instruction) => {
    if (!("parsed" in instruction)) {
      return false;
    }

    const parsed = instruction.parsed as {
      type?: string;
      info?: {
        mint?: string;
        authority?: string;
        owner?: string;
        source?: string;
        destination?: string;
        tokenAmount?: { amount?: string };
        amount?: string;
      };
    };
    const info = parsed.info;
    if (!info) {
      return false;
    }

    if (parsed.type === "transferChecked") {
      return (
        info.mint === mint.toBase58() &&
        info.authority === userWallet.toBase58() &&
        info.destination === treasuryAta.toBase58() &&
        BigInt(info.tokenAmount?.amount || 0) >= expectedRaw
      );
    }

    return false;
  });

  if (!matched) {
    throw new GameError("Deposit transaction did not transfer the expected $GROW amount.", 400);
  }

  return {
    signature: params.signature,
    rawAmount: expectedRaw,
    mock: false
  };
}

export async function sendGrowWithdrawal(params: {
  toWallet: string;
  amount: number;
}) {
  assertTokenRuntimeConfigured();
  if (isMockTokenMode()) {
    return `mock-withdraw-${Date.now()}`;
  }

  const connection = getSolanaConnection();
  const mint = new PublicKey(process.env.GROW_TOKEN_MINT!);
  const treasury = parseTreasuryKeypair();
  const destinationOwner = new PublicKey(params.toWallet);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury.publicKey);
  const destinationAta = await getAssociatedTokenAddress(mint, destinationOwner);
  const mintInfo = await getMint(connection, mint);
  const rawAmount = BigInt(params.amount) * bigintPow10(mintInfo.decimals);
  const transaction = new Transaction();

  await getAccount(connection, destinationAta).catch(() => {
    transaction.add(
      createAssociatedTokenAccountInstruction(
        treasury.publicKey,
        destinationAta,
        destinationOwner,
        mint
      )
    );
  });

  transaction.add(
    createTransferCheckedInstruction(
      treasuryAta,
      mint,
      destinationAta,
      treasury.publicKey,
      rawAmount,
      mintInfo.decimals
    )
  );

  return sendAndConfirmTransaction(connection, transaction, [treasury], {
    commitment: "confirmed"
  });
}

export async function mintDevnetGrow(params: {
  walletAddress: string;
  amount?: number;
}) {
  assertDevnetServerFeatureEnabled({
    flagName: "ENABLE_DEVNET_SERVER_MINT",
    featureName: "Devnet $GROW minting",
  });
  if (!process.env.GROW_TOKEN_MINT) {
    throw new GameError("GROW_TOKEN_MINT is not configured on the server.", 503);
  }

  const connection = getSolanaConnection();
  const mint = new PublicKey(process.env.GROW_TOKEN_MINT);
  const destinationOwner = new PublicKey(params.walletAddress);
  const authority = parseMintAuthorityKeypair();
  const tokenProgram = await getMintProgram(connection, mint);
  const mintInfo = await getMint(connection, mint, "confirmed", tokenProgram);
  const amount = Math.max(
    1,
    Math.floor(params.amount || Number(process.env.DEVNET_GROW_MINT_AMOUNT || 1000))
  );
  const rawAmount = BigInt(amount) * bigintPow10(mintInfo.decimals);
  const destinationAta = await getAssociatedTokenAddress(
    mint,
    destinationOwner,
    true,
    tokenProgram
  );
  const transaction = new Transaction().add(
    createAssociatedTokenAccountIdempotentInstruction(
      authority.publicKey,
      destinationAta,
      destinationOwner,
      mint,
      tokenProgram
    ),
    createMintToCheckedInstruction(
      mint,
      destinationAta,
      authority.publicKey,
      rawAmount,
      mintInfo.decimals,
      [],
      tokenProgram
    )
  );

  const signature = await sendAndConfirmTransaction(
    connection,
    transaction,
    [authority],
    { commitment: "confirmed" }
  );

  return {
    signature,
    amount,
    rawAmount: rawAmount.toString(),
    mint: mint.toBase58(),
    ata: destinationAta.toBase58(),
  };
}
