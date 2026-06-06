import { unstable_cache } from "next/cache";

import {
  HOTEL_EXPERIENCE_CATEGORIES,
  HOTEL_EXPERIENCE_PREFERENCES,
} from "@/lib/hotel-experience-options";
import { prisma } from "@/lib/prisma";
import { PUBLIC_HOTEL_WHERE } from "@/lib/public-hotel";

export { HOTEL_EXPERIENCE_CATEGORIES, HOTEL_EXPERIENCE_PREFERENCES };

export type PublicHotelExperience = {
  id: string;
  title: string;
  city: string;
  state: string;
  shortDescription: string;
  imageUrl: string;
  imageAlt: string;
  categories: string[];
  preferences: string[];
  distanceText: string | null;
  hotel: {
    id: string;
    name: string;
    slug: string;
    city: string;
    state: string;
  };
};

async function fetchPublicHotelExperiences(): Promise<PublicHotelExperience[]> {
  return prisma.hotelExperience.findMany({
    where: {
      isActive: true,
      hotel: PUBLIC_HOTEL_WHERE,
    },
    select: {
      id: true,
      title: true,
      city: true,
      state: true,
      shortDescription: true,
      imageUrl: true,
      imageAlt: true,
      categories: true,
      preferences: true,
      distanceText: true,
      hotel: {
        select: {
          id: true,
          name: true,
          slug: true,
          city: true,
          state: true,
        },
      },
    },
    orderBy: [{ city: "asc" }, { title: "asc" }],
  });
}

export const getPublicHotelExperiences = unstable_cache(
  fetchPublicHotelExperiences,
  ["public-hotel-experiences"],
  {
    revalidate: 300,
    tags: ["public-hotel-experiences"],
  }
);
