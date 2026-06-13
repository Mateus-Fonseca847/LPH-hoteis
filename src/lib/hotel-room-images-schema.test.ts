import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("HotelRoomImage schema", () => {
  it("mantém imageUrl legado e cria relação de múltiplas imagens", () => {
    const schema = readFileSync(new URL("../../prisma/schema.prisma", import.meta.url), "utf8");

    expect(schema).toContain("model HotelRoom {");
    expect(schema).toContain("imageUrl         String");
    expect(schema).toContain("images           HotelRoomImage[]");
    expect(schema).toContain("model HotelRoomImage {");
    expect(schema).toContain("roomId    String");
    expect(schema).toContain("url       String");
    expect(schema).toContain("alt       String");
    expect(schema).toContain("position  Int");
    expect(schema).toContain("@@unique([roomId, url])");
    expect(schema).toContain("@@index([roomId, position])");
  });

  it("migra imagens legadas sem duplicar por quarto e URL", () => {
    const migration = readFileSync(
      new URL(
        "../../prisma/migrations/20260613120000_add_hotel_room_images/migration.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(migration).toContain('CREATE TABLE "HotelRoomImage"');
    expect(migration).toContain('FROM "HotelRoom" room');
    expect(migration).toContain("'Imagem do quarto ' || room.\"name\"");
    expect(migration).toContain("NOT EXISTS");
    expect(migration).toContain('image."roomId" = room."id"');
    expect(migration).toContain('image."url" = room."imageUrl"');
    expect(migration).toContain('CREATE UNIQUE INDEX "HotelRoomImage_roomId_url_key"');
  });

  it("carrega imagens do quarto nas consultas pública e administrativa com fallback legado", () => {
    const hotelData = readFileSync(new URL("./hotel-data.ts", import.meta.url), "utf8");
    const roomActions = readFileSync(
      new URL("../app/admin/hoteis/[id]/room-actions.ts", import.meta.url),
      "utf8"
    );
    const editPage = readFileSync(
      new URL("../app/admin/hoteis/[id]/page.tsx", import.meta.url),
      "utf8"
    );

    expect(hotelData).toContain("images: {");
    expect(hotelData).toContain("id: `${room.id}-legacy-image`");
    expect(hotelData).toContain("alt: `Imagem do quarto ${room.name}`");
    expect(roomActions).toContain("images?: Array");
    expect(roomActions).toContain("buildRoomImagesPayload");
    expect(roomActions).toContain("tx.hotelRoomImage.deleteMany");
    expect(roomActions).toContain("tx.hotelRoomImage.createMany");
    expect(roomActions).toContain("removeHotelRoomImageAction");
    expect(roomActions).toContain("Imagem removida com sucesso.");
    expect(editPage).toContain("images: {");
  });

  it("admin de quartos envia múltiplos arquivos e mantém imageUrl como primeira imagem", () => {
    const roomSection = readFileSync(
      new URL("../app/admin/hoteis/[id]/HotelRoomsSection.tsx", import.meta.url),
      "utf8"
    );
    const uploadRoute = readFileSync(
      new URL("../app/api/admin/hoteis/[id]/quartos/upload/route.ts", import.meta.url),
      "utf8"
    );

    expect(roomSection).toContain("multiple");
    expect(roomSection).toContain('formData.append("files", file)');
    expect(roomSection).toContain("Imagens do quarto enviadas com sucesso.");
    expect(roomSection).toContain('onChange("imageUrl", nextImages[0]?.url ?? "")');
    expect(roomSection).toContain("removeHotelRoomImageAction");
    expect(uploadRoute).toContain('formData.getAll("files")');
    expect(uploadRoute).toContain("storedImages.map");
    expect(uploadRoute).toContain("Falha ao enviar imagem do quarto.");
  });
});
