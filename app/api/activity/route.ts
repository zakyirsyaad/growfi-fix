import { getCurrentUser } from "@/lib/auth/server";
import { getActivity } from "@/lib/game/service";
import { handleApiError, ok } from "@/lib/utils/api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok(await getActivity(user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
