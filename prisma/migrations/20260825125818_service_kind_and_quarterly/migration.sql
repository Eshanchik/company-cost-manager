-- Домены как вид сервиса + квартальный цикл оплаты.

-- CreateEnum
CREATE TYPE "ServiceKind" AS ENUM ('service', 'domain');

-- AlterEnum: квартальная оплата
ALTER TYPE "BillingCycle" ADD VALUE 'quarterly';

-- AlterTable
ALTER TABLE "service"
  ADD COLUMN "kind" "ServiceKind" NOT NULL DEFAULT 'service',
  ADD COLUMN "registrar" TEXT,
  ADD COLUMN "autoRenew" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "externalSource" TEXT,
  ADD COLUMN "externalId" TEXT;

-- CreateIndex: идемпотентный импорт из внешнего реестра (DomainGuard)
CREATE UNIQUE INDEX "service_externalSource_externalId_key"
  ON "service"("externalSource", "externalId");

-- CreateIndex
CREATE INDEX "service_kind_idx" ON "service"("kind");
