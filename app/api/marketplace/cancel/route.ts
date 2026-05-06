import { getCurrentUser } from "@/lib/auth/server";
import { cancelMarketplaceListing } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { listingIdSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`market-cancel:${user.id}`, 30, 60_000);
    const input = await parseJson(request, listingIdSchema);
    return ok(await cancelMarketplaceListing(user.id, input.listingId));
  } catch (error) {
    return handleApiError(error);
  }
}
