-- Store footer promotion opt-ins without sensitive data.
CREATE TABLE "MarketingSubscriber" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "consentAccepted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "unsubscribedAt" TIMESTAMP(3),

    CONSTRAINT "MarketingSubscriber_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MarketingSubscriber_email_key" ON "MarketingSubscriber"("email");
CREATE INDEX "MarketingSubscriber_source_idx" ON "MarketingSubscriber"("source");
CREATE INDEX "MarketingSubscriber_isActive_idx" ON "MarketingSubscriber"("isActive");
CREATE INDEX "MarketingSubscriber_createdAt_idx" ON "MarketingSubscriber"("createdAt");
