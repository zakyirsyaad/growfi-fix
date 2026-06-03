"use client";

import bs58 from "bs58";
import type { WalletContextState } from "@solana/wallet-adapter-react";
import { apiFetch } from "@/lib/utils/fetcher";

type WalletChallengeResponse = {
  message: string;
  walletAddress: string;
};

export async function connectVerifiedWallet(wallet: WalletContextState) {
  const walletAddress = wallet.publicKey?.toBase58();
  if (!walletAddress) {
    throw new Error("Connect a Solana wallet first.");
  }
  if (!wallet.signMessage) {
    throw new Error("This wallet does not support message signing.");
  }

  const challenge = await apiFetch<WalletChallengeResponse>(
    "/api/wallet/challenge",
    {
      method: "POST",
      body: JSON.stringify({ walletAddress }),
    }
  );

  const signatureBytes = await wallet.signMessage(
    new TextEncoder().encode(challenge.message)
  );

  return apiFetch("/api/wallet/connect", {
    method: "POST",
    body: JSON.stringify({
      walletAddress: challenge.walletAddress,
      message: challenge.message,
      signature: bs58.encode(signatureBytes),
    }),
  });
}
