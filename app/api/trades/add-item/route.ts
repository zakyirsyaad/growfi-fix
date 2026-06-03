import { getCurrentUser } from "@/lib/auth/server";
import { addTradeItem } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { tradeAddItemSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    await rateLimit(`trade-add:${user.id}`, 50, 60_000);
    const input = await parseJson(request, tradeAddItemSchema);
    return ok({ item: await addTradeItem(user.id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
