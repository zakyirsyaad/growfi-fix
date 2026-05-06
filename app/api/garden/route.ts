import { getCurrentUser } from "@/lib/auth/server";
import { getGardenState } from "@/lib/game/service";
import { handleApiError, ok } from "@/lib/utils/api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok(await getGardenState(user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
