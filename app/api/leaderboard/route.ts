import { getLeaderboard } from "@/lib/game/service";
import { handleApiError, ok } from "@/lib/utils/api";

export async function GET() {
  try {
    return ok(await getLeaderboard());
  } catch (error) {
    return handleApiError(error);
  }
}
