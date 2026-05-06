import { getCurrentUser } from "@/lib/auth/server";
import { getInventory } from "@/lib/game/service";
import { handleApiError, ok } from "@/lib/utils/api";

export async function GET() {
  try {
    const user = await getCurrentUser();
    return ok(await getInventory(user.id));
  } catch (error) {
    return handleApiError(error);
  }
}
