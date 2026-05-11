ALTER TYPE "TransactionType" ADD VALUE IF NOT EXISTS 'TUTORIAL_REWARD';

ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'QUEST_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TUTORIAL_COMPLETED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TRADE_INVITE_RECEIVED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'FARM_UPGRADE_OPENED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'MARKETPLACE_EXPIRED';
ALTER TYPE "ActivityType" ADD VALUE IF NOT EXISTS 'TRADE_EXPIRED';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "tutorialCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tutorialSkippedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "tutorialRewardedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "TutorialProgress" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "stepKey" TEXT NOT NULL,
  "progress" INTEGER NOT NULL DEFAULT 0,
  "target" INTEGER NOT NULL,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "TutorialProgress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TutorialProgress_userId_stepKey_key"
  ON "TutorialProgress"("userId", "stepKey");

CREATE INDEX IF NOT EXISTS "TutorialProgress_userId_idx"
  ON "TutorialProgress"("userId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TutorialProgress_userId_fkey'
      AND table_name = 'TutorialProgress'
  ) THEN
    ALTER TABLE "TutorialProgress"
      ADD CONSTRAINT "TutorialProgress_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
