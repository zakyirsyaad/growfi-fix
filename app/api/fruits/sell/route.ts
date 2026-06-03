import { getCurrentUser } from "@/lib/auth/server";
import { sellFruitToSystem } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { fruitSellSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    await rateLimit(`fruit-sell:${user.id}`, 40, 60_000);
    const input = await parseJson(request, fruitSellSchema);
    return ok(await sellFruitToSystem(user.id, input));
  } catch (error) {
    return handleApiError(error);
  }
}
