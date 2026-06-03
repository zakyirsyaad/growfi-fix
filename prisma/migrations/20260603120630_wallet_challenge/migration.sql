ALTER TABLE "User" ADD COLUMN "walletChallengeNonce" TEXT;
ALTER TABLE "User" ADD COLUMN "walletChallengeExpiresAt" TIMESTAMP(3);
