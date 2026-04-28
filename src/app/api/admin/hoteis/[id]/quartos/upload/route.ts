import { createApiSuccessResponse, NotFoundError, ValidationError } from "@/lib/errors/app-error";
import {
  createHotelWriteApiErrorResponse,
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
      throw new ValidationError(parsedParams.error.issues[0]?.message || "Identificador invalido.");
    }

    const hotelId = parsedParams.data.hotelId;
    await requireAuthorizedHotelWrite(hotelId);

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
      throw new NotFoundError("Hotel nao encontrado.");
    }

    const formData = await request.formData();
    const fileEntry = formData.get("file");

    if (!(fileEntry instanceof File)) {
      throw new ValidationError("Selecione uma imagem valida.");
    }

    const storedImage = await storeHotelImageFile(hotelId, fileEntry);

    return createApiSuccessResponse({
      image: {
        url: storedImage.url,
      },
    });
  } catch (error) {
    return createHotelWriteApiErrorResponse(
      error,
      "Nao foi possivel concluir o upload da imagem do quarto."
    );
  }
}
