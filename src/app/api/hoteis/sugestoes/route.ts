import { createApiErrorResponse, createApiSuccessResponse } from "@/lib/errors/app-error";
import { getHotelSearchSuggestions, normalizeHotelSearchQuery } from "@/lib/hotel-search";

const SEARCH_SUGGESTIONS_FAILURE = "Não foi possível buscar sugestões.";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const query = normalizeHotelSearchQuery(url.searchParams.get("q") ?? "");

    if (query.length < 2) {
      return createApiSuccessResponse({
        suggestions: [],
      });
    }

    const suggestions = await getHotelSearchSuggestions(query);

    return createApiSuccessResponse({
      suggestions,
    });
  } catch (error) {
    return createApiErrorResponse(error, SEARCH_SUGGESTIONS_FAILURE);
  }
}
