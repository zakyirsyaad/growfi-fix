import { z } from "zod";

export const connectWalletSchema = z.object({
  walletAddress: z.string().min(32).max(64)
});

export const walletChallengeSchema = z.object({
  walletAddress: z.string().min(32).max(64)
});

export const devnetMintGrowSchema = z.object({
  walletAddress: z.string().min(32).max(64)
});

export const plantSchema = z.object({
  plotId: z.string().min(1),
  seedId: z.string().min(1)
});

export const plotActionSchema = z.object({
  plotId: z.string().min(1)
});

export const shopBuySchema = z.object({
  shopItemId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99)
});

export const fruitSellSchema = z.object({
  userFruitId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(100_000)
});

export const marketplaceListSchema = z.object({
  userFruitId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(100_000),
  price: z.coerce.number().int().min(1).max(1_000_000_000)
});

export const listingIdSchema = z.object({
  listingId: z.string().min(1)
});

export const tradeCreateSchema = z.object({
  recipientId: z.string().optional(),
  recipientUsername: z.string().min(1).max(64).optional()
}).refine((value) => value.recipientId || value.recipientUsername, {
  message: "Provide a recipient id or username."
});

export const tradeAddItemSchema = z.discriminatedUnion("type", [
  z.object({
    tradeId: z.string().min(1),
    type: z.literal("FRUIT"),
    userFruitId: z.string().min(1),
    quantity: z.coerce.number().int().min(1).max(100_000)
  }),
  z.object({
    tradeId: z.string().min(1),
    type: z.literal("GROW"),
    growAmount: z.coerce.number().int().min(1).max(1_000_000_000)
  })
]);

export const tradeRemoveItemSchema = z.object({
  tradeId: z.string().min(1),
  itemId: z.string().min(1)
});

export const tradeIdSchema = z.object({
  tradeId: z.string().min(1)
});

export const depositVerifySchema = z.object({
  signature: z.string().min(3).max(256),
  amount: z.coerce.number().int().min(1).max(1_000_000_000)
});

export const withdrawSchema = z.object({
  amount: z.coerce.number().int().min(1).max(1_000_000_000)
});

export const questClaimSchema = z.object({
  questKey: z.string().min(1).max(80)
});

export const questProgressSchema = z.object({
  action: z.enum([
    "visit_town",
    "open_marketplace"
  ]),
  amount: z.coerce.number().int().min(1).max(100_000).default(1)
});

export const tutorialProgressSchema = z.object({
  action: z.enum([
    "open_upgrade"
  ]),
  amount: z.coerce.number().int().min(1).max(100_000).default(1)
});

export const tutorialUpdateSchema = z.union([
  z.object({ skip: z.literal(true) }),
  tutorialProgressSchema
]);
