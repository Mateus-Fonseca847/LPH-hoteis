import { redirect } from "next/navigation";

type HotelAvailabilityRedirectPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function HotelAvailabilityRedirectPage({
  params,
}: HotelAvailabilityRedirectPageProps) {
  const { slug } = await params;

  redirect(`/hoteis/${slug}`);
}
