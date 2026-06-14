import { getCurrentUser } from "@/lib/auth/server";
import { plantSeed } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { plantSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    await rateLimit(`plant:${user.id}`, 40, 60_000);
    const input = await parseJson(request, plantSchema);
    return ok({ plant: await plantSeed(user.id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
