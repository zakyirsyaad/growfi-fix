import { getCurrentUser } from "@/lib/auth/server";
import { withdrawGrow } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { withdrawSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    await rateLimit(`withdraw:${user.id}`, 10, 60_000);
    const input = await parseJson(request, withdrawSchema);
    return ok(await withdrawGrow(user.id, input.amount));
  } catch (error) {
    return handleApiError(error);
  }
}
