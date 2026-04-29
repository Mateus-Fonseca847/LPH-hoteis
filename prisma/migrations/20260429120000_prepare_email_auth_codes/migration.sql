-- CreateEnum
CREATE TYPE "EmailAuthCodePurpose" AS ENUM ('login_2fa', 'email_verification', 'password_reset');

-- AlterTable
ALTER TABLE "User"
  ADD COLUMN "emailVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "emailTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "EmailAuthCode" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "purpose" "EmailAuthCodePurpose" NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "usedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmailAuthCode_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailAuthCode_userId_idx" ON "EmailAuthCode"("userId");

-- CreateIndex
CREATE INDEX "EmailAuthCode_purpose_idx" ON "EmailAuthCode"("purpose");

-- CreateIndex
CREATE INDEX "EmailAuthCode_expiresAt_idx" ON "EmailAuthCode"("expiresAt");

-- CreateIndex
CREATE INDEX "EmailAuthCode_userId_purpose_expiresAt_idx" ON "EmailAuthCode"("userId", "purpose", "expiresAt");

-- AddForeignKey
ALTER TABLE "EmailAuthCode"
  ADD CONSTRAINT "EmailAuthCode_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
