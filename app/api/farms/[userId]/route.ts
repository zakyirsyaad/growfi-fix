import { getCurrentUser } from "@/lib/auth/server";
import { getPublicFarm } from "@/lib/game/service";
import { handleApiError, ok } from "@/lib/utils/api";

export async function GET(_: Request, { params }: { params: Promise<{ userId: string }> }) {
  try {
    await getCurrentUser();
    const { userId } = await params;
    return ok(await getPublicFarm(userId));
  } catch (error) {
    return handleApiError(error);
  }
}
