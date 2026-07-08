ALTER TABLE "Hotel"
ADD COLUMN "isArchived" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedById" TEXT;

CREATE INDEX "Hotel_isArchived_idx" ON "Hotel"("isArchived");
CREATE INDEX "Hotel_archivedById_idx" ON "Hotel"("archivedById");

ALTER TABLE "Hotel"
ADD CONSTRAINT "Hotel_archivedById_fkey"
FOREIGN KEY ("archivedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
