import bs58 from "bs58";
import nacl from "tweetnacl";
import { PublicKey } from "@solana/web3.js";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/db/prisma";
import { GameError } from "@/lib/game/errors";
import { connectWallet } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { connectWalletSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`wallet-connect:${user.id}`, 10, 60_000);
    const input = await parseJson(request, connectWalletSchema);

    const wallet = new PublicKey(input.walletAddress);
    const freshUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        walletChallengeNonce: true,
        walletChallengeExpiresAt: true
      }
    });

    if (
      !freshUser.walletChallengeNonce ||
      !freshUser.walletChallengeExpiresAt ||
      freshUser.walletChallengeExpiresAt.getTime() < Date.now()
    ) {
      throw new GameError("Wallet verification challenge has expired.", 409);
    }

    if (!input.message.includes(freshUser.walletChallengeNonce)) {
      throw new GameError("Wallet verification challenge does not match.", 409);
    }

    const verified = nacl.sign.detached.verify(
      new TextEncoder().encode(input.message),
      bs58.decode(input.signature),
      wallet.toBytes()
    );

    if (!verified) {
      throw new GameError("Wallet signature is invalid.", 401);
    }

    const connected = await connectWallet(user.id, wallet.toBase58());
    await prisma.user.update({
      where: { id: user.id },
      data: {
        walletChallengeNonce: null,
        walletChallengeExpiresAt: null
      }
    });

    return ok({ user: connected });
  } catch (error) {
    return handleApiError(error);
  }
}
