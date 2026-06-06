import type { MetadataRoute } from "next";

import { getPublishedHotels } from "@/lib/hotel-data";
import { getSiteUrl } from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = getSiteUrl();
  const hotels = await getPublishedHotels();

  return [
    {
      url: new URL("/", siteUrl).toString(),
      changeFrequency: "weekly",
      priority: 1,
    },
    ...hotels.map((hotel) => ({
      url: new URL(`/hoteis/${hotel.slug}`, siteUrl).toString(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
