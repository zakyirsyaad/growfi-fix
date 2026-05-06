import type { Rarity } from "@prisma/client";
import { Mutation } from "@prisma/client";
import {
  MUTATION_MULTIPLIERS,
  MUTATION_WEIGHTED_ROLL,
  RARITY_MUTATION_BONUS_BPS
} from "@/lib/game/constants";

export function rollInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function rollMutation(baseChanceBps: number, rarity: Rarity, waterLevel = 0): Mutation {
  const waterBonus = Math.min(waterLevel, 5) * 25;
  const chanceBps = Math.min(
    9500,
    baseChanceBps + RARITY_MUTATION_BONUS_BPS[rarity] + waterBonus
  );
  const success = rollInteger(1, 10_000) <= chanceBps;

  if (!success) {
    return "NORMAL";
  }

  const roll = rollInteger(1, 100);
  let cursor = 0;
  for (const item of MUTATION_WEIGHTED_ROLL) {
    cursor += item.weight;
    if (roll <= cursor) {
      return item.mutation;
    }
  }

  return "BIG";
}

export function calculateFruitSellPrice(baseSellPrice: number, mutation: Mutation, quantity: number) {
  return Math.floor(baseSellPrice * MUTATION_MULTIPLIERS[mutation] * quantity);
}
