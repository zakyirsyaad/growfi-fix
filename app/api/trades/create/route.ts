import { getCurrentUser } from "@/lib/auth/server";
import { createTrade } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { tradeCreateSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`trade-create:${user.id}`, 20, 60_000);
    const input = await parseJson(request, tradeCreateSchema);
    return ok({ trade: await createTrade(user.id, input) });
  } catch (error) {
    return handleApiError(error);
  }
}
