import { getCurrentUser } from "@/lib/auth/server";
import { searchPublicFarms } from "@/lib/game/service";
import { handleApiError, ok } from "@/lib/utils/api";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser();
    const { searchParams } = new URL(request.url);
    return ok(await searchPublicFarms(user.id, searchParams.get("query") || ""));
  } catch (error) {
    return handleApiError(error);
  }
}
