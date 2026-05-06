import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { prisma } from "@/lib/db/prisma";
import { GameError } from "@/lib/game/errors";
import { ensureStarterGarden } from "@/lib/game/user";

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    throw new GameError("You must be logged in with Discord.", 401);
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new GameError("Session user was not found.", 401);
  }

  await ensureStarterGarden(user.id);
  return user;
}
