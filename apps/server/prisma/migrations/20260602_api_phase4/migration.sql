-- AlterTable
ALTER TABLE "api_keys" ADD COLUMN "scopes" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "credit_transactions" ADD COLUMN "apiKeyId" TEXT;

-- CreateIndex
CREATE INDEX "credit_transactions_apiKeyId_idx" ON "credit_transactions"("apiKeyId");

-- AddForeignKey
ALTER TABLE "credit_transactions" ADD CONSTRAINT "credit_transactions_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "api_idempotency_records" (
    "id" TEXT NOT NULL,
    "apiKeyId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "statusCode" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_idempotency_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "api_idempotency_records_apiKeyId_idempotencyKey_key" ON "api_idempotency_records"("apiKeyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "api_idempotency_records_expiresAt_idx" ON "api_idempotency_records"("expiresAt");

-- AddForeignKey
ALTER TABLE "api_idempotency_records" ADD CONSTRAINT "api_idempotency_records_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "api_keys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
