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
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint
} from "@solana/spl-token";
import { GameError } from "@/lib/game/errors";

export function isMockTokenMode() {
  return !process.env.GROW_TOKEN_MINT || !process.env.TREASURY_WALLET_PUBLIC_KEY;
}

export function getSolanaConnection() {
  return new Connection(process.env.SOLANA_RPC_URL || "https://api.devnet.solana.com", "confirmed");
}

function parseTreasuryKeypair() {
  const secret = process.env.TREASURY_WALLET_PRIVATE_KEY;
  if (!secret) {
    throw new GameError("Treasury private key is not configured.", 500);
  }

  try {
    const parsed = JSON.parse(secret) as number[];
    return Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch {
    return Keypair.fromSecretKey(bs58.decode(secret));
  }
}

function bigintPow10(decimals: number) {
  return BigInt(10) ** BigInt(decimals);
}

export async function verifyGrowDeposit(params: {
  signature: string;
  userWallet: string;
  amount: number;
}) {
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
