import { getCurrentUser } from "@/lib/auth/server";
import { harvestPlant } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { plotActionSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    await rateLimit(`harvest:${user.id}`, 50, 60_000);
    const input = await parseJson(request, plotActionSchema);
    return ok(await harvestPlant(user.id, input));
  } catch (error) {
    return handleApiError(error);
  }
}
