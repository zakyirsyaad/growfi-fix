import type { Prisma, User } from "@prisma/client";
import { STAMINA_REGEN_SECONDS } from "@/lib/game/constants";
import { GameError } from "@/lib/game/errors";

type DbLike = Prisma.TransactionClient;

export function calculateStamina(user: Pick<User, "stamina" | "maxStamina" | "lastStaminaUpdatedAt">) {
  const now = new Date();
  const elapsedSeconds = Math.max(
    0,
    Math.floor((now.getTime() - user.lastStaminaUpdatedAt.getTime()) / 1000)
  );
  const regenerated = Math.floor(elapsedSeconds / STAMINA_REGEN_SECONDS);
  const stamina = Math.min(user.maxStamina, user.stamina + regenerated);
  const consumedRegenSeconds = regenerated * STAMINA_REGEN_SECONDS;
  const lastStaminaUpdatedAt =
    stamina >= user.maxStamina
      ? now
      : new Date(user.lastStaminaUpdatedAt.getTime() + consumedRegenSeconds * 1000);

  return {
    stamina,
    maxStamina: user.maxStamina,
    lastStaminaUpdatedAt,
    nextStaminaAt:
      stamina >= user.maxStamina
        ? null
        : new Date(lastStaminaUpdatedAt.getTime() + STAMINA_REGEN_SECONDS * 1000)
  };
}

export async function lockUser(tx: DbLike, userId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
}

export async function refreshStamina(tx: DbLike, userId: string) {
  await lockUser(tx, userId);
  const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
  const computed = calculateStamina(user);

  if (
    computed.stamina !== user.stamina ||
    computed.lastStaminaUpdatedAt.getTime() !== user.lastStaminaUpdatedAt.getTime()
  ) {
    return tx.user.update({
      where: { id: userId },
      data: {
        stamina: computed.stamina,
        lastStaminaUpdatedAt: computed.lastStaminaUpdatedAt
      }
    });
  }

  return user;
}

export async function consumeStamina(tx: DbLike, userId: string, amount: number) {
  const user = await refreshStamina(tx, userId);
  if (user.stamina < amount) {
    throw new GameError("Not enough stamina.", 409);
  }

  return tx.user.update({
    where: { id: userId },
    data: {
      stamina: { decrement: amount },
      lastStaminaUpdatedAt: new Date()
    }
  });
}
