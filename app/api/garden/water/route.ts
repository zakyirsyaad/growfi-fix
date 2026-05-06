import { getCurrentUser } from "@/lib/auth/server";
import { waterPlant } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { plotActionSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`water:${user.id}`, 60, 60_000);
    const input = await parseJson(request, plotActionSchema);
    return ok({ plant: await waterPlant(user.id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
