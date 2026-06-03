import { getCurrentUser } from "@/lib/auth/server";
import { trackDailyQuestAction } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { questProgressSchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    await rateLimit(`quest-progress:${user.id}`, 60, 60_000);
    const input = await parseJson(request, questProgressSchema);
    return ok({ updates: await trackDailyQuestAction(user.id, input.action, input.amount) });
  } catch (error) {
    return handleApiError(error);
  }
}

