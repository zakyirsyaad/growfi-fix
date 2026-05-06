import { getCurrentUser } from "@/lib/auth/server";
import { refillWateringCan } from "@/lib/game/service";
import { handleApiError, ok } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";

export async function POST() {
  try {
    const user = await getCurrentUser();
    rateLimit(`refill-water:${user.id}`, 20, 60_000);
    return ok({ user: await refillWateringCan(user.id) });
  } catch (error) {
    return handleApiError(error);
  }
}
