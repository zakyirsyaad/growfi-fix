import { getCurrentUser } from "@/lib/auth/server";
import { buyShopItem } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { shopBuySchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`shop-buy:${user.id}`, 40, 60_000);
    const input = await parseJson(request, shopBuySchema);
    return ok(await buyShopItem(user.id, input));
  } catch (error) {
    return handleApiError(error);
  }
}
