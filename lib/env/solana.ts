import { PublicKey } from "@solana/web3.js";
import { GameError } from "@/lib/game/errors";

export const CLIENT_SOLANA_ENV_KEYS = [
  "NEXT_PUBLIC_SOLANA_RPC_URL",
  "NEXT_PUBLIC_TOKEN_CLUSTER",
  "NEXT_PUBLIC_TOKEN_MODE",
  "NEXT_PUBLIC_MOCK_TOKEN_MODE",
  "NEXT_PUBLIC_GROWFI_CORE_PROGRAM_ID",
  "NEXT_PUBLIC_GROW_TOKEN_MINT",
  "NEXT_PUBLIC_GROW_TOKEN_DECIMALS",
  "NEXT_PUBLIC_TREASURY_WALLET_PUBLIC_KEY",
  "NEXT_PUBLIC_TREASURY_TOKEN_ACCOUNT",
] as const;

export const SERVER_SOLANA_ENV_KEYS = [
  "SOLANA_RPC_URL",
  "TOKEN_CLUSTER",
  "TOKEN_MODE",
  "GROWFI_CORE_PROGRAM_ID",
  "GROW_TOKEN_MINT",
  "GROW_TOKEN_DECIMALS",
  "TREASURY_WALLET_PUBLIC_KEY",
  "TREASURY_TOKEN_ACCOUNT",
  "TREASURY_WALLET_SECRET_KEY",
  "MINT_AUTHORITY_SECRET_KEY",
  "ENABLE_DEVNET_SERVER_MINT",
  "ENABLE_DEVNET_SHOP_AUTOMATION",
] as const;

export function requireEnv(name: string, options?: { devnetOnly?: boolean }) {
  const value = process.env[name];
  if (!value && !options?.devnetOnly) {
    throw new GameError(`${name} is not configured.`, 500);
  }
  return value || "";
}

export function validatePublicKeyEnv(name: string, options?: { optional?: boolean }) {
  const value = process.env[name];
  if (!value && options?.optional) {
    return null;
  }
  if (!value) {
    throw new GameError(`${name} is not configured.`, 500);
  }
  try {
    return new PublicKey(value);
  } catch {
    throw new GameError(`${name} is not a valid Solana public key.`, 500);
  }
}

export function validateDevnetServerEnv() {
  if ((process.env.TOKEN_CLUSTER || "devnet") !== "devnet") {
    throw new GameError("TOKEN_CLUSTER must be devnet for this devnet helper.", 500);
  }
  if ((process.env.TOKEN_MODE || "devnet") !== "devnet") {
    throw new GameError("TOKEN_MODE must be devnet for this devnet helper.", 500);
  }
}

export function isTruthyEnv(name: string) {
  const value = process.env[name]?.trim().toLowerCase();
  return value === "1" || value === "true" || value === "yes" || value === "on";
}

export function assertDevnetServerFeatureEnabled(params: {
  flagName: string;
  featureName: string;
}) {
  validateDevnetServerEnv();

  if (process.env.NODE_ENV !== "production") {
    return;
  }

  if (!isTruthyEnv(params.flagName)) {
    throw new GameError(
      `${params.featureName} is disabled in production. Set ${params.flagName}=true and keep TOKEN_MODE=devnet to enable it for a devnet deployment.`,
      403
    );
  }
}
