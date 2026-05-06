-- Extend game economy/activity enums.
ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'DAILY_QUEST_REWARD';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'WATER_REFILLED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'DAILY_QUEST_CLAIMED';

-- Seed-specific regrow and harvest limits.
ALTER TABLE "SeedCatalog"
  ADD COLUMN IF NOT EXISTS "regrowTimeSeconds" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "maxHarvests" INTEGER NOT NULL DEFAULT 1;

UPDATE "SeedCatalog"
SET "regrowTimeSeconds" = "harvestCooldownSeconds"
WHERE "regrowTimeSeconds" = 0 AND "harvestCooldownSeconds" > 0;

-- Watering can state.
ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "maxWaterCharges" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS "waterCharges" INTEGER NOT NULL DEFAULT 20;

-- Daily quest MVP progress.
CREATE TABLE IF NOT EXISTS "DailyQuestProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "questKey" TEXT NOT NULL,
  "questDate" TIMESTAMP(3) NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "target" INTEGER NOT NULL,
  "rewardGrow" INTEGER NOT NULL DEFAULT 0,
  "claimed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DailyQuestProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyQuestProgress_userId_questKey_questDate_key"
  ON "DailyQuestProgress"("userId", "questKey", "questDate");

CREATE INDEX IF NOT EXISTS "DailyQuestProgress_userId_questDate_idx"
  ON "DailyQuestProgress"("userId", "questDate");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'DailyQuestProgress_userId_fkey'
      AND table_name = 'DailyQuestProgress'
  ) THEN
    ALTER TABLE "DailyQuestProgress"
      ADD CONSTRAINT "DailyQuestProgress_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
