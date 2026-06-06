import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Consultar disponibilidade",
  description: "Redirecionamento para a página dedicada de consulta de disponibilidade.",
  robots: {
    index: false,
    follow: true,
  },
};

type LegacyHotelAvailabilityPageProps = {
  params: Promise<{
    slug: string;
  }>;
  searchParams?: Promise<{
    quarto?: string;
  }>;
};

export default async function LegacyHotelAvailabilityPage({
  params,
  searchParams,
}: LegacyHotelAvailabilityPageProps) {
  const { slug } = await params;
  const query = searchParams ? await searchParams : {};
  const roomQuery = query.quarto ? `?quarto=${encodeURIComponent(query.quarto)}` : "";

  redirect(`/hoteis/${slug}/reservar${roomQuery}`);
}
