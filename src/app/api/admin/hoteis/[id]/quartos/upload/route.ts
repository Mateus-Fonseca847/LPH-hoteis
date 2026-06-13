import { createApiSuccessResponse, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import {
  createHotelWriteApiErrorResponse,
  getRequestIpAddress,
  parseHotelRouteParams,
  requireAuthorizedHotelWrite,
} from "@/lib/hotel-write";
import { prisma } from "@/lib/prisma";
import { storeHotelImageFile } from "@/lib/uploads/hotel-images";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const parsedParams = parseHotelRouteParams({ hotelId: id });

    if (!parsedParams.success) {
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador inválido.");
    }

    const hotelId = parsedParams.data.hotelId;
    const user = await requireAuthorizedHotelWrite(hotelId);

    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      throw new ValidationError("Envie a imagem em multipart/form-data.");
    }

    const hotel = await prisma.hotel.findUnique({
      where: {
        id: hotelId,
      },
      select: {
        id: true,
      },
    });

    if (!hotel) {
      throw new NotFoundError("Hotel não encontrado.");
    }

    const formData = await request.formData();
    const fileEntries = [...formData.getAll("files"), ...formData.getAll("file")].filter(
      (entry): entry is File => entry instanceof File && entry.size > 0
    );

    if (fileEntries.length === 0) {
      throw new ValidationError("Selecione uma imagem válida.");
    }

    const storedImages = await Promise.all(
      fileEntries.map((fileEntry) => storeHotelImageFile(hotelId, fileEntry))
    );
    const ipAddress = getRequestIpAddress(request.headers);

    await prisma.hotelAuditLog.create({
      data: {
        userId: user.id,
        hotelId,
        action: "hotel.room_image.uploaded",
        changedFields: ["roomImageUrl"],
        previousValue: {},
        newValue: {
          urls: storedImages.map((storedImage) => storedImage.url),
        },
        ipAddress,
      },
    });

    return createApiSuccessResponse({
      images: storedImages.map((storedImage) => ({
        url: storedImage.url,
      })),
      image: {
        url: storedImages[0].url,
      },
    });
  } catch (error) {
    return createHotelWriteApiErrorResponse(error, "Falha ao enviar imagem do quarto.");
  }
}
