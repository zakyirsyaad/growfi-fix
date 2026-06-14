import crypto from "node:crypto";
import { PublicKey } from "@solana/web3.js";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { GameError } from "@/lib/game/errors";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { walletChallengeSchema } from "@/lib/validations/schemas";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    await rateLimit(`wallet-challenge:${user.id}`, 10, 60_000);
    const input = await parseJson(request, walletChallengeSchema);

    let wallet: PublicKey;
    try {
      wallet = new PublicKey(input.walletAddress);
    } catch {
      throw new GameError("Wallet address is not a valid Solana address.", 422);
    }

    const nonce = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + 5 * 60_000);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        walletChallengeNonce: nonce,
        walletChallengeExpiresAt: expiresAt
      }
    });

    return ok({
      walletAddress: wallet.toBase58(),
      message: `GrowFi wallet verification\nUser: ${user.id}\nWallet: ${wallet.toBase58()}\nNonce: ${nonce}\nExpires: ${expiresAt.toISOString()}`
    });
  } catch (error) {
    return handleApiError(error);
  }
}
