-- CreateTable
CREATE TABLE "HotelExperience" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "shortDescription" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "imageAlt" TEXT NOT NULL,
    "categories" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "preferences" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "distanceText" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelExperience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HotelExperience_hotelId_idx" ON "HotelExperience"("hotelId");

-- CreateIndex
CREATE INDEX "HotelExperience_isActive_idx" ON "HotelExperience"("isActive");

-- CreateIndex
CREATE INDEX "HotelExperience_city_state_idx" ON "HotelExperience"("city", "state");

-- CreateIndex
CREATE INDEX "HotelExperience_hotelId_isActive_idx" ON "HotelExperience"("hotelId", "isActive");

-- AddForeignKey
ALTER TABLE "HotelExperience" ADD CONSTRAINT "HotelExperience_hotelId_fkey" FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;
