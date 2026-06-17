import { normalizeText } from "@/lib/normalize-text";

type PublicHotelIdentity = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
  city?: string | null;
  state?: string | null;
};

function normalizeKey(value: string | null | undefined) {
  return value?.trim() ? normalizeText(value) : "";
}

function getHotelIdentityKeys(hotel: PublicHotelIdentity) {
  const id = normalizeKey(hotel.id);
  const slug = normalizeKey(hotel.slug);

  if (id || slug) {
    return [id ? `id:${id}` : "", slug ? `slug:${slug}` : ""].filter(Boolean);
  }

  const name = normalizeKey(hotel.name);
  const city = normalizeKey(hotel.city);
  const state = normalizeKey(hotel.state);

  return name && city && state ? [`name-city-state:${name}|${city}|${state}`] : [];
}

export function dedupePublicHotels<T extends PublicHotelIdentity>(
  hotels: T[],
  context = "home/hotels"
) {
  const seen = new Set<string>();
  const duplicateKeys = new Set<string>();
  const uniqueHotels: T[] = [];

  for (const hotel of hotels) {
    const keys = getHotelIdentityKeys(hotel);
    const isDuplicate = keys.some((key) => seen.has(key));

    if (isDuplicate) {
      keys.forEach((key) => {
        if (seen.has(key)) {
          duplicateKeys.add(key);
        }
      });
      continue;
    }

    keys.forEach((key) => seen.add(key));
    uniqueHotels.push(hotel);
  }

  if (duplicateKeys.size > 0) {
    console.warn(`[${context}] Deduplicated public hotels.`, {
      before: hotels.length,
      after: uniqueHotels.length,
      duplicateKeys: Array.from(duplicateKeys),
    });
  }

  return uniqueHotels;
}
