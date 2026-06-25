-- CreateTable
CREATE TABLE "CashBalance" (
    "id" TEXT NOT NULL,
    "portfolioId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(24,8) NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CashBalance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashBalance_portfolioId_idx" ON "CashBalance"("portfolioId");

-- CreateIndex
CREATE UNIQUE INDEX "CashBalance_portfolioId_currency_key" ON "CashBalance"("portfolioId", "currency");

-- AddForeignKey
ALTER TABLE "CashBalance" ADD CONSTRAINT "CashBalance_portfolioId_fkey" FOREIGN KEY ("portfolioId") REFERENCES "Portfolio"("id") ON DELETE CASCADE ON UPDATE CASCADE;
