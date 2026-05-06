import { getCurrentUser } from "@/lib/auth/server";
import { verifyDeposit } from "@/lib/game/service";
import { handleApiError, ok, parseJson } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";
import { depositVerifySchema } from "@/lib/validations/schemas";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    rateLimit(`deposit:${user.id}`, 20, 60_000);
    const input = await parseJson(request, depositVerifySchema);
    return ok(await verifyDeposit(user.id, input));
  } catch (error) {
    return handleApiError(error);
  }
}
