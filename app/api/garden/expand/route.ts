import { getCurrentUser } from "@/lib/auth/server";
import { expandGarden } from "@/lib/game/service";
import { handleApiError, ok } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";

export async function POST() {
  try {
    const user = await getCurrentUser();
    rateLimit(`expand:${user.id}`, 5, 60_000);
    return ok({ garden: await expandGarden(user.id) });
  } catch (error) {
    return handleApiError(error);
  }
}
