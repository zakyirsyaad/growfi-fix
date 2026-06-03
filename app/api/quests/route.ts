import { getCurrentUser } from "@/lib/auth/server";
import { claimDailyQuest, getDailyQuests } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { questClaimSchema } from "@/lib/validations/schemas";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok({ quests: await getDailyQuests(user.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    await rateLimit(`claim-quest:${user.id}`, 20, 60_000);
    const input = await parseJson(request, questClaimSchema);
    return ok({ quests: await claimDailyQuest(user.id, input.questKey) });
  } catch (error) {
    return handleApiError(error);
  }
}
