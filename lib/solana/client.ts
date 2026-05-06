"use client";

import {
  PublicKey,
  Transaction,
  type Connection
} from "@solana/web3.js";
import {
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
  getAssociatedTokenAddress,
  getMint
} from "@solana/spl-token";

function pow10(decimals: number) {
  return BigInt(10) ** BigInt(decimals);
}

export function hasClientTokenConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_GROW_TOKEN_MINT &&
      process.env.NEXT_PUBLIC_TREASURY_WALLET_PUBLIC_KEY &&
      process.env.NEXT_PUBLIC_MOCK_TOKEN_MODE !== "true"
  );
}

export async function buildDepositTransaction(params: {
  connection: Connection;
  wallet: PublicKey;
  amount: number;
}) {
  const mint = new PublicKey(process.env.NEXT_PUBLIC_GROW_TOKEN_MINT!);
  const treasury = new PublicKey(process.env.NEXT_PUBLIC_TREASURY_WALLET_PUBLIC_KEY!);
  const sourceAta = await getAssociatedTokenAddress(mint, params.wallet);
  const treasuryAta = await getAssociatedTokenAddress(mint, treasury);
  const mintInfo = await getMint(params.connection, mint);
  const amount = BigInt(params.amount) * pow10(mintInfo.decimals);
  const transaction = new Transaction();

  await getAccount(params.connection, treasuryAta).catch(() => {
    transaction.add(
      createAssociatedTokenAccountInstruction(params.wallet, treasuryAta, treasury, mint)
    );
  });

  transaction.add(
    createTransferCheckedInstruction(
      sourceAta,
      mint,
      treasuryAta,
      params.wallet,
      amount,
      mintInfo.decimals
    )
  );

  return transaction;
}
