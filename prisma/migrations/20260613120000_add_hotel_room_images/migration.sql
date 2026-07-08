-- CreateTable
CREATE TABLE "HotelRoomImage" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "alt" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HotelRoomImage_pkey" PRIMARY KEY ("id")
);

-- Backfill existing single-image rooms without duplicating if the migration body is replayed.
INSERT INTO "HotelRoomImage" ("id", "roomId", "url", "alt", "position", "createdAt", "updatedAt")
SELECT
    'room_image_' || md5(room."id" || ':' || room."imageUrl"),
    room."id",
    room."imageUrl",
    'Imagem do quarto ' || room."name",
    0,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "HotelRoom" room
WHERE
    btrim(room."imageUrl") <> ''
    AND NOT EXISTS (
        SELECT 1
        FROM "HotelRoomImage" image
        WHERE image."roomId" = room."id"
          AND image."url" = room."imageUrl"
    );

-- CreateIndex
CREATE UNIQUE INDEX "HotelRoomImage_roomId_url_key" ON "HotelRoomImage"("roomId", "url");

-- CreateIndex
CREATE INDEX "HotelRoomImage_roomId_position_idx" ON "HotelRoomImage"("roomId", "position");

-- AddForeignKey
ALTER TABLE "HotelRoomImage" ADD CONSTRAINT "HotelRoomImage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "HotelRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
