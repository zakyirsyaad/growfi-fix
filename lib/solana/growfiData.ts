import type { Mutation, Rarity, SeedView, FruitView } from "@/types/game-data";

export type OnchainSeedMetadata = {
  seedId: number;
  fruitId: number;
  slug: string;
  name: string;
  fruitName: string;
  rarity: Rarity;
  price: number;
  growTimeSeconds: number;
  regrowTimeSeconds: number;
  harvestCooldownSeconds: number;
  minYield: number;
  maxYield: number;
  maxHarvests: number;
  requiredGardenLevel: number;
  baseSellPrice: number;
};

export const ONCHAIN_SEEDS: OnchainSeedMetadata[] = [
  {
    seedId: 1,
    fruitId: 1,
    slug: "carrot",
    name: "Carrot Seed",
    fruitName: "Carrot",
    rarity: "COMMON",
    price: 2,
    growTimeSeconds: 300,
    regrowTimeSeconds: 0,
    harvestCooldownSeconds: 0,
    minYield: 1,
    maxYield: 3,
    maxHarvests: 1,
    requiredGardenLevel: 1,
    baseSellPrice: 2,
  },
  {
    seedId: 2,
    fruitId: 2,
    slug: "tomato",
    name: "Tomato Seed",
    fruitName: "Tomato",
    rarity: "COMMON",
    price: 4,
    growTimeSeconds: 600,
    regrowTimeSeconds: 300,
    harvestCooldownSeconds: 300,
    minYield: 2,
    maxYield: 4,
    maxHarvests: 3,
    requiredGardenLevel: 1,
    baseSellPrice: 3,
  },
  {
    seedId: 3,
    fruitId: 3,
    slug: "strawberry",
    name: "Strawberry Seed",
    fruitName: "Strawberry",
    rarity: "UNCOMMON",
    price: 15,
    growTimeSeconds: 1200,
    regrowTimeSeconds: 600,
    harvestCooldownSeconds: 600,
    minYield: 2,
    maxYield: 5,
    maxHarvests: 5,
    requiredGardenLevel: 2,
    baseSellPrice: 7,
  },
  {
    seedId: 4,
    fruitId: 4,
    slug: "blueberry",
    name: "Blueberry Seed",
    fruitName: "Blueberry",
    rarity: "UNCOMMON",
    price: 18,
    growTimeSeconds: 1500,
    regrowTimeSeconds: 720,
    harvestCooldownSeconds: 720,
    minYield: 3,
    maxYield: 6,
    maxHarvests: 6,
    requiredGardenLevel: 2,
    baseSellPrice: 6,
  },
  {
    seedId: 5,
    fruitId: 5,
    slug: "watermelon",
    name: "Watermelon Seed",
    fruitName: "Watermelon",
    rarity: "RARE",
    price: 50,
    growTimeSeconds: 3600,
    regrowTimeSeconds: 1800,
    harvestCooldownSeconds: 1800,
    minYield: 1,
    maxYield: 3,
    maxHarvests: 2,
    requiredGardenLevel: 3,
    baseSellPrice: 30,
  },
  {
    seedId: 6,
    fruitId: 6,
    slug: "dragon-fruit",
    name: "Dragon Fruit Seed",
    fruitName: "Dragon Fruit",
    rarity: "RARE",
    price: 80,
    growTimeSeconds: 5400,
    regrowTimeSeconds: 2700,
    harvestCooldownSeconds: 2700,
    minYield: 1,
    maxYield: 3,
    maxHarvests: 10,
    requiredGardenLevel: 3,
    baseSellPrice: 48,
  },
  {
    seedId: 7,
    fruitId: 7,
    slug: "crystal-apple",
    name: "Crystal Apple Seed",
    fruitName: "Crystal Apple",
    rarity: "EPIC",
    price: 200,
    growTimeSeconds: 10800,
    regrowTimeSeconds: 5400,
    harvestCooldownSeconds: 5400,
    minYield: 1,
    maxYield: 2,
    maxHarvests: 15,
    requiredGardenLevel: 4,
    baseSellPrice: 150,
  },
  {
    seedId: 8,
    fruitId: 8,
    slug: "golden-mango",
    name: "Golden Mango Seed",
    fruitName: "Golden Mango",
    rarity: "LEGENDARY",
    price: 500,
    growTimeSeconds: 21600,
    regrowTimeSeconds: 7200,
    harvestCooldownSeconds: 7200,
    minYield: 1,
    maxYield: 2,
    maxHarvests: 20,
    requiredGardenLevel: 5,
    baseSellPrice: 400,
  },
  {
    seedId: 9,
    fruitId: 9,
    slug: "time-flower",
    name: "Time Flower Seed",
    fruitName: "Time Flower",
    rarity: "MYTHIC",
    price: 1500,
    growTimeSeconds: 43200,
    regrowTimeSeconds: 14400,
    harvestCooldownSeconds: 14400,
    minYield: 1,
    maxYield: 1,
    maxHarvests: 25,
    requiredGardenLevel: 5,
    baseSellPrice: 1300,
  },
];

export const MUTATION_VARIANTS: Record<Mutation, string> = {
  NORMAL: "Normal",
  BIG: "Big",
  SWEET: "Sweet",
  GOLDEN: "Golden",
  CRYSTAL: "Crystal",
  RAINBOW: "Rainbow",
};

export function findOnchainSeed(
  input?: Partial<SeedView> | Partial<FruitView> | string | number | null
) {
  if (input == null) {
    return null;
  }
  if (typeof input === "number") {
    return (
      ONCHAIN_SEEDS.find(
        (seed) => seed.seedId === input || seed.fruitId === input
      ) || null
    );
  }
  if (typeof input === "string") {
    const normalized = input.toLowerCase();
    return (
      ONCHAIN_SEEDS.find(
        (seed) =>
          seed.slug === normalized ||
          seed.name.toLowerCase() === normalized ||
          seed.fruitName.toLowerCase() === normalized
      ) || null
    );
  }
  const slug = "slug" in input ? input.slug : undefined;
  const name = "name" in input ? input.name : undefined;
  return findOnchainSeed(slug || name || null);
}
