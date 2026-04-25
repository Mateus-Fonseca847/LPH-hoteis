-- CreateTable
CREATE TABLE "HotelRoom" (
    "id" TEXT NOT NULL,
    "hotelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "capacityAdults" INTEGER NOT NULL DEFAULT 1,
    "capacityChildren" INTEGER NOT NULL DEFAULT 0,
    "beds" TEXT NOT NULL,
    "size" TEXT NOT NULL,
    "sizeM2" INTEGER,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "priceFrom" DECIMAL(10,2) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RoomRate" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "minNights" INTEGER NOT NULL DEFAULT 1,
    "maxGuests" INTEGER NOT NULL,
    "refundable" BOOLEAN NOT NULL DEFAULT false,
    "breakfastIncluded" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoomRate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HotelRoom_hotelId_idx" ON "HotelRoom"("hotelId");
CREATE INDEX "HotelRoom_hotelId_isActive_idx" ON "HotelRoom"("hotelId", "isActive");
CREATE INDEX "HotelRoom_hotelId_isAvailable_idx" ON "HotelRoom"("hotelId", "isAvailable");

CREATE INDEX "RoomRate_roomId_idx" ON "RoomRate"("roomId");
CREATE INDEX "RoomRate_isActive_idx" ON "RoomRate"("isActive");
CREATE INDEX "RoomRate_startDate_idx" ON "RoomRate"("startDate");
CREATE INDEX "RoomRate_endDate_idx" ON "RoomRate"("endDate");
CREATE INDEX "RoomRate_roomId_isActive_idx" ON "RoomRate"("roomId", "isActive");
CREATE INDEX "RoomRate_roomId_startDate_endDate_idx" ON "RoomRate"("roomId", "startDate", "endDate");

-- AddForeignKey
ALTER TABLE "HotelRoom" ADD CONSTRAINT "HotelRoom_hotelId_fkey"
FOREIGN KEY ("hotelId") REFERENCES "Hotel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "RoomRate" ADD CONSTRAINT "RoomRate_roomId_fkey"
FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
