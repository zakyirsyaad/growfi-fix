import { getCurrentUser } from "@/lib/auth/server";
import { cancelTrade } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { tradeIdSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`trade-cancel:${user.id}`, 30, 60_000);
    const input = await parseJson(request, tradeIdSchema);
    return ok({ trade: await cancelTrade(user.id, input.tradeId) });
  } catch (error) {
    return handleApiError(error);
  }
}
