import { getCurrentUser } from "@/lib/auth/server";
import { connectWallet } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { connectWalletSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`wallet-connect:${user.id}`, 10, 60_000);
    const input = await parseJson(request, connectWalletSchema);
    return ok({ user: await connectWallet(user.id, input.walletAddress) });
  } catch (error) {
    return handleApiError(error);
  }
}
