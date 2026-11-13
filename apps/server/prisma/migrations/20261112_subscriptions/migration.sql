-- Subscriptions by kind. CREDITS subscriptions live here; the scheduler
-- subscription stays on users for now. The enum values are first used in the
-- next migration: Postgres can't use a new enum value in the transaction
-- that adds it.

-- CreateEnum
CREATE TYPE "SubscriptionKind" AS ENUM ('SCHEDULER', 'CREDITS');

-- AlterEnum
ALTER TYPE "PlanType" ADD VALUE 'CREDIT_SUBSCRIPTION';

-- AlterEnum
ALTER TYPE "CreditSource" ADD VALUE 'MONTHLY_CREDITS';

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "SubscriptionKind" NOT NULL,
    "stripeSubscriptionId" TEXT NOT NULL,
    "stripePriceId" TEXT,
    "planKey" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "isCancelled" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_stripeSubscriptionId_key" ON "subscriptions"("stripeSubscriptionId");

-- CreateIndex
CREATE INDEX "subscriptions_kind_planKey_isActive_idx" ON "subscriptions"("kind", "planKey", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "subscriptions_userId_kind_key" ON "subscriptions"("userId", "kind");

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

