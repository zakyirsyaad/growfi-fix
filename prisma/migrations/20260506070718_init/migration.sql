-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('COMMON', 'UNCOMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHIC');

-- CreateEnum
CREATE TYPE "PlotState" AS ENUM ('EMPTY', 'GROWING', 'READY', 'REGROWING', 'LOCKED');

-- CreateEnum
CREATE TYPE "PlantState" AS ENUM ('GROWING', 'READY', 'REGROWING', 'DEAD');

-- CreateEnum
CREATE TYPE "Mutation" AS ENUM ('NORMAL', 'BIG', 'SWEET', 'GOLDEN', 'CRYSTAL', 'RAINBOW');

-- CreateEnum
CREATE TYPE "RotationStatus" AS ENUM ('ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('ACTIVE', 'SOLD', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TradeStatus" AS ENUM ('PENDING', 'ACTIVE', 'LOCKED', 'COMPLETED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OfferItemType" AS ENUM ('FRUIT', 'GROW');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('DEPOSIT', 'WITHDRAW', 'SYSTEM_SELL', 'SHOP_BUY', 'MARKETPLACE_BUY', 'MARKETPLACE_SELL', 'MARKETPLACE_FEE', 'TRADE_TRANSFER', 'GARDEN_EXPAND', 'MOCK_CREDIT');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('SEED_BOUGHT', 'PLANT_PLANTED', 'PLANT_WATERED', 'FRUIT_HARVESTED', 'FRUIT_SOLD', 'MARKETPLACE_LISTED', 'MARKETPLACE_SOLD', 'MARKETPLACE_CANCELLED', 'TRADE_CREATED', 'TRADE_UPDATED', 'TRADE_COMPLETED', 'TRADE_CANCELLED', 'DEPOSIT', 'WITHDRAW', 'GARDEN_EXPANDED', 'WALLET_CONNECTED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "discordId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "walletAddress" TEXT,
    "growBalance" INTEGER NOT NULL DEFAULT 100,
    "lockedGrowBalance" INTEGER NOT NULL DEFAULT 0,
    "maxStamina" INTEGER NOT NULL DEFAULT 100,
    "stamina" INTEGER NOT NULL DEFAULT 100,
    "lastStaminaUpdatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gardenLevel" INTEGER NOT NULL DEFAULT 1,
    "totalHarvests" INTEGER NOT NULL DEFAULT 0,
    "totalTrades" INTEGER NOT NULL DEFAULT 0,
    "marketplaceSales" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Wallet" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL DEFAULT 'solana',
    "verifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Wallet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Garden" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "width" INTEGER NOT NULL DEFAULT 4,
    "height" INTEGER NOT NULL DEFAULT 4,
    "level" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Garden_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GardenPlot" (
    "id" TEXT NOT NULL,
    "gardenId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "state" "PlotState" NOT NULL DEFAULT 'EMPTY',
    "plantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GardenPlot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SeedCatalog" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "basePrice" INTEGER NOT NULL,
    "growTimeSeconds" INTEGER NOT NULL,
    "harvestCooldownSeconds" INTEGER NOT NULL,
    "minYield" INTEGER NOT NULL,
    "maxYield" INTEGER NOT NULL,
    "mutationChanceBps" INTEGER NOT NULL,
    "requiredGardenLevel" INTEGER NOT NULL DEFAULT 1,
    "iconUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SeedCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FruitCatalog" (
    "id" TEXT NOT NULL,
    "seedId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "baseSellPrice" INTEGER NOT NULL,
    "iconUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FruitCatalog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSeed" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seedId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSeed_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserFruit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fruitId" TEXT NOT NULL,
    "mutation" "Mutation" NOT NULL DEFAULT 'NORMAL',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "lockedQuantity" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFruit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPlant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gardenPlotId" TEXT NOT NULL,
    "seedId" TEXT NOT NULL,
    "plantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "growCompleteAt" TIMESTAMP(3) NOT NULL,
    "nextHarvestAt" TIMESTAMP(3),
    "lastWateredAt" TIMESTAMP(3),
    "waterLevel" INTEGER NOT NULL DEFAULT 0,
    "waterBoostSeconds" INTEGER NOT NULL DEFAULT 0,
    "health" INTEGER NOT NULL DEFAULT 100,
    "permanentMutation" "Mutation",
    "harvestCount" INTEGER NOT NULL DEFAULT 0,
    "state" "PlantState" NOT NULL DEFAULT 'GROWING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPlant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopRotation" (
    "id" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "status" "RotationStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopRotation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopItem" (
    "id" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "seedId" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "stockTotal" INTEGER NOT NULL,
    "stockRemaining" INTEGER NOT NULL,
    "maxBuyPerUser" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopPurchase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rotationId" TEXT NOT NULL,
    "shopItemId" TEXT NOT NULL,
    "seedId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "totalPrice" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopPurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketplaceListing" (
    "id" TEXT NOT NULL,
    "sellerId" TEXT NOT NULL,
    "fruitId" TEXT NOT NULL,
    "mutation" "Mutation" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" INTEGER NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'ACTIVE',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "soldAt" TIMESTAMP(3),
    "buyerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "initiatorId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "status" "TradeStatus" NOT NULL DEFAULT 'PENDING',
    "initiatorConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "recipientConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TradeOfferItem" (
    "id" TEXT NOT NULL,
    "tradeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "OfferItemType" NOT NULL,
    "fruitId" TEXT,
    "mutation" "Mutation",
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "growAmount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TradeOfferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" INTEGER NOT NULL,
    "signature" TEXT,
    "status" "TransactionStatus" NOT NULL DEFAULT 'PENDING',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "targetUserId" TEXT,
    "type" "ActivityType" NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "SystemBalance" (
    "id" TEXT NOT NULL DEFAULT 'system',
    "treasuryBalance" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_discordId_key" ON "User"("discordId");

-- CreateIndex
CREATE UNIQUE INDEX "User_walletAddress_key" ON "User"("walletAddress");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Wallet_address_key" ON "Wallet"("address");

-- CreateIndex
CREATE INDEX "Wallet_userId_idx" ON "Wallet"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Garden_userId_key" ON "Garden"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GardenPlot_plantId_key" ON "GardenPlot"("plantId");

-- CreateIndex
CREATE INDEX "GardenPlot_gardenId_state_idx" ON "GardenPlot"("gardenId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "GardenPlot_gardenId_x_y_key" ON "GardenPlot"("gardenId", "x", "y");

-- CreateIndex
CREATE UNIQUE INDEX "SeedCatalog_slug_key" ON "SeedCatalog"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "FruitCatalog_seedId_key" ON "FruitCatalog"("seedId");

-- CreateIndex
CREATE UNIQUE INDEX "FruitCatalog_slug_key" ON "FruitCatalog"("slug");

-- CreateIndex
CREATE INDEX "UserSeed_userId_idx" ON "UserSeed"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSeed_userId_seedId_key" ON "UserSeed"("userId", "seedId");

-- CreateIndex
CREATE INDEX "UserFruit_userId_idx" ON "UserFruit"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserFruit_userId_fruitId_mutation_key" ON "UserFruit"("userId", "fruitId", "mutation");

-- CreateIndex
CREATE INDEX "UserPlant_userId_state_idx" ON "UserPlant"("userId", "state");

-- CreateIndex
CREATE INDEX "UserPlant_gardenPlotId_idx" ON "UserPlant"("gardenPlotId");

-- CreateIndex
CREATE INDEX "ShopRotation_status_endsAt_idx" ON "ShopRotation"("status", "endsAt");

-- CreateIndex
CREATE INDEX "ShopItem_rotationId_idx" ON "ShopItem"("rotationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopItem_rotationId_seedId_key" ON "ShopItem"("rotationId", "seedId");

-- CreateIndex
CREATE INDEX "ShopPurchase_rotationId_idx" ON "ShopPurchase"("rotationId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopPurchase_userId_shopItemId_key" ON "ShopPurchase"("userId", "shopItemId");

-- CreateIndex
CREATE INDEX "MarketplaceListing_status_expiresAt_idx" ON "MarketplaceListing"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "MarketplaceListing_sellerId_idx" ON "MarketplaceListing"("sellerId");

-- CreateIndex
CREATE INDEX "Trade_initiatorId_status_idx" ON "Trade"("initiatorId", "status");

-- CreateIndex
CREATE INDEX "Trade_recipientId_status_idx" ON "Trade"("recipientId", "status");

-- CreateIndex
CREATE INDEX "Trade_status_expiresAt_idx" ON "Trade"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "TradeOfferItem_tradeId_idx" ON "TradeOfferItem"("tradeId");

-- CreateIndex
CREATE INDEX "TradeOfferItem_userId_idx" ON "TradeOfferItem"("userId");

-- CreateIndex
CREATE INDEX "Transaction_userId_createdAt_idx" ON "Transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Transaction_signature_idx" ON "Transaction"("signature");

-- CreateIndex
CREATE INDEX "ActivityLog_actorId_createdAt_idx" ON "ActivityLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_type_createdAt_idx" ON "ActivityLog"("type", "createdAt");

-- AddForeignKey
ALTER TABLE "Wallet" ADD CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Garden" ADD CONSTRAINT "Garden_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GardenPlot" ADD CONSTRAINT "GardenPlot_gardenId_fkey" FOREIGN KEY ("gardenId") REFERENCES "Garden"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GardenPlot" ADD CONSTRAINT "GardenPlot_plantId_fkey" FOREIGN KEY ("plantId") REFERENCES "UserPlant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FruitCatalog" ADD CONSTRAINT "FruitCatalog_seedId_fkey" FOREIGN KEY ("seedId") REFERENCES "SeedCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSeed" ADD CONSTRAINT "UserSeed_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSeed" ADD CONSTRAINT "UserSeed_seedId_fkey" FOREIGN KEY ("seedId") REFERENCES "SeedCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFruit" ADD CONSTRAINT "UserFruit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserFruit" ADD CONSTRAINT "UserFruit_fruitId_fkey" FOREIGN KEY ("fruitId") REFERENCES "FruitCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPlant" ADD CONSTRAINT "UserPlant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPlant" ADD CONSTRAINT "UserPlant_seedId_fkey" FOREIGN KEY ("seedId") REFERENCES "SeedCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPlant" ADD CONSTRAINT "UserPlant_gardenPlotId_fkey" FOREIGN KEY ("gardenPlotId") REFERENCES "GardenPlot"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopItem" ADD CONSTRAINT "ShopItem_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "ShopRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopItem" ADD CONSTRAINT "ShopItem_seedId_fkey" FOREIGN KEY ("seedId") REFERENCES "SeedCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPurchase" ADD CONSTRAINT "ShopPurchase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPurchase" ADD CONSTRAINT "ShopPurchase_rotationId_fkey" FOREIGN KEY ("rotationId") REFERENCES "ShopRotation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShopPurchase" ADD CONSTRAINT "ShopPurchase_shopItemId_fkey" FOREIGN KEY ("shopItemId") REFERENCES "ShopItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_sellerId_fkey" FOREIGN KEY ("sellerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceListing" ADD CONSTRAINT "MarketplaceListing_fruitId_fkey" FOREIGN KEY ("fruitId") REFERENCES "FruitCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOfferItem" ADD CONSTRAINT "TradeOfferItem_tradeId_fkey" FOREIGN KEY ("tradeId") REFERENCES "Trade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOfferItem" ADD CONSTRAINT "TradeOfferItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TradeOfferItem" ADD CONSTRAINT "TradeOfferItem_fruitId_fkey" FOREIGN KEY ("fruitId") REFERENCES "FruitCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
