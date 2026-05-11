import { PublicKey } from "@solana/web3.js";
import { getCurrentUser } from "@/lib/auth/server";
import { GameError } from "@/lib/game/errors";
import { mintDevnetGrow } from "@/lib/solana/token";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { devnetMintGrowSchema } from "@/lib/validations/schemas";

export const runtime = "nodejs";

function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    const input = await parseJson(request, devnetMintGrowSchema);
    let wallet: PublicKey;
    try {
      wallet = new PublicKey(input.walletAddress);
    } catch {
      throw new GameError("Wallet address is not a valid Solana address.", 422);
    }
    rateLimit(`mint-grow:wallet:${wallet.toBase58()}`, 5, 60 * 60_000);
    rateLimit(`mint-grow:ip:${clientIp(request)}`, 20, 60 * 60_000);

    if (process.env.NODE_ENV === "production") {
      throw new GameError("Devnet minting is disabled in production.", 403);
    }

    const result = await mintDevnetGrow({
      walletAddress: wallet.toBase58(),
    });

    return ok({
      ...result,
      walletAddress: wallet.toBase58(),
      requestedBy: user.id,
      explorerUrl: `https://explorer.solana.com/tx/${result.signature}?cluster=devnet`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
