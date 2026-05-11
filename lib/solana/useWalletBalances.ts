"use client";

import { useMemo } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { useQuery } from "@tanstack/react-query";

type ConfigLike = {
  growMint?: PublicKey | string;
  treasuryVault?: PublicKey | string;
};

function publicKeyString(value: unknown) {
  if (!value) {
    return null;
  }
  if (value instanceof PublicKey) {
    return value.toBase58();
  }
  if (typeof value === "string" && value.length > 0) {
    return value;
  }
  if (typeof value === "object" && "toBase58" in value) {
    return (value as { toBase58: () => string }).toBase58();
  }
  return null;
}

export function clientGrowMintFromConfig(config?: unknown) {
  const fromEnv = process.env.NEXT_PUBLIC_GROW_TOKEN_MINT;
  if (fromEnv) {
    return fromEnv;
  }
  return publicKeyString((config as ConfigLike | undefined)?.growMint);
}

export function clientTreasuryVaultFromConfig(config?: unknown) {
  return (
    process.env.NEXT_PUBLIC_TREASURY_TOKEN_ACCOUNT ||
    publicKeyString((config as ConfigLike | undefined)?.treasuryVault)
  );
}

export function shortAddress(address?: string | null) {
  if (!address) {
    return "Not connected";
  }
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function useWalletBalances(input?: {
  mintAddress?: string | null;
  enabled?: boolean;
}) {
  const { connection } = useConnection();
  const wallet = useWallet();
  const owner = wallet.publicKey;
  const mintAddress = input?.mintAddress || null;
  const enabled = input?.enabled ?? true;

  const queryKey = useMemo(
    () => [
      "wallet-balances",
      connection.rpcEndpoint,
      owner?.toBase58(),
      mintAddress,
    ],
    [connection.rpcEndpoint, mintAddress, owner]
  );

  return useQuery({
    queryKey,
    enabled: enabled && !!owner,
    refetchInterval: 20_000,
    queryFn: async () => {
      if (!owner) {
        throw new Error("Connect a wallet first.");
      }

      const solLamports = await connection.getBalance(owner, "confirmed");
      const sol = solLamports / LAMPORTS_PER_SOL;

      if (!mintAddress) {
        return {
          solLamports,
          sol,
          grow: null,
        };
      }

      const mint = new PublicKey(mintAddress);
      const mintAccount = await connection.getAccountInfo(mint, "confirmed");
      if (!mintAccount) {
        return {
          solLamports,
          sol,
          grow: {
            mint: mint.toBase58(),
            ata: null,
            exists: false,
            balance: 0,
            balanceRaw: "0",
            decimals: Number(process.env.NEXT_PUBLIC_GROW_TOKEN_DECIMALS || 9),
            tokenProgram: null,
          },
        };
      }

      const tokenProgram = mintAccount.owner.equals(TOKEN_2022_PROGRAM_ID)
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;
      const ata = getAssociatedTokenAddressSync(
        mint,
        owner,
        true,
        tokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const ataInfo = await connection.getAccountInfo(ata, "confirmed");
      if (!ataInfo) {
        return {
          solLamports,
          sol,
          grow: {
            mint: mint.toBase58(),
            ata: ata.toBase58(),
            exists: false,
            balance: 0,
            balanceRaw: "0",
            decimals: Number(process.env.NEXT_PUBLIC_GROW_TOKEN_DECIMALS || 9),
            tokenProgram: tokenProgram.toBase58(),
          },
        };
      }

      const tokenBalance = await connection.getTokenAccountBalance(
        ata,
        "confirmed"
      );
      return {
        solLamports,
        sol,
        grow: {
          mint: mint.toBase58(),
          ata: ata.toBase58(),
          exists: true,
          balance: tokenBalance.value.uiAmount ?? 0,
          balanceRaw: tokenBalance.value.amount,
          decimals: tokenBalance.value.decimals,
          tokenProgram: tokenProgram.toBase58(),
        },
      };
    },
  });
}
