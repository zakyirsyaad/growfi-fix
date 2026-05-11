import type { Rarity } from "@prisma/client";
import { Mutation } from "@prisma/client";
import {
  MAX_MUTATION_CHANCE_BPS,
  MUTATION_MULTIPLIERS,
  MUTATION_ROLL_MAX_BPS,
  MUTATION_WATER_BONUS_BPS_PER_LEVEL,
  MUTATION_WEIGHTED_ROLL,
  MAX_WATER_LEVEL,
  RARITY_MUTATION_BONUS_BPS
} from "@/lib/game/constants";

export function rollInteger(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function rollMutation(baseChanceBps: number, rarity: Rarity, waterLevel = 0): Mutation {
  const waterBonus = Math.min(waterLevel, MAX_WATER_LEVEL) * MUTATION_WATER_BONUS_BPS_PER_LEVEL;
  const chanceBps = Math.min(
    MAX_MUTATION_CHANCE_BPS,
    baseChanceBps + RARITY_MUTATION_BONUS_BPS[rarity] + waterBonus
  );
  const success = rollInteger(1, MUTATION_ROLL_MAX_BPS) <= chanceBps;

  if (!success) {
    return "NORMAL";
  }

  const roll = rollInteger(
    1,
    MUTATION_WEIGHTED_ROLL.reduce((sum, item) => sum + item.weight, 0)
  );
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
