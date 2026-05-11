import { getCurrentUser } from "@/lib/auth/server";
import { getTutorialStatus, skipTutorial, trackTutorialAction } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { tutorialUpdateSchema } from "@/lib/validations/schemas";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok({ tutorial: await getTutorialStatus(user.id) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`tutorial:${user.id}`, 60, 60_000);
    const input = await parseJson(request, tutorialUpdateSchema);

    if ("skip" in input) {
      return ok(await skipTutorial(user.id));
    }

    return ok(await trackTutorialAction(user.id, input.action, input.amount));
  } catch (error) {
    return handleApiError(error);
  }
}

