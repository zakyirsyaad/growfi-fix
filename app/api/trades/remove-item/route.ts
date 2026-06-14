import { getCurrentUser } from "@/lib/auth/server";
import { removeTradeItem } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { tradeRemoveItemSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    await rateLimit(`trade-remove:${user.id}`, 50, 60_000);
    const input = await parseJson(request, tradeRemoveItemSchema);
    return ok(await removeTradeItem(user.id, input));
  } catch (error) {
    return handleApiError(error);
  }
}
