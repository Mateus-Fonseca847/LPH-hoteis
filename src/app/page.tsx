import type { Metadata } from "next";

import { ExperienceSection } from "@/components/ExperienceSection";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import { Hero } from "@/components/Hero";
import { HotelsCarousel } from "@/components/HotelsCarousel";
import { RevealObserver } from "@/components/RevealObserver";
import { StayDetailsSection } from "@/components/StayDetailsSection";
import { TestimonialsSection } from "@/components/TestimonialsSection";
import { getPublishedHotels } from "@/lib/hotel-data";
import {
  DEFAULT_SOCIAL_IMAGE_ALT,
  DEFAULT_SOCIAL_IMAGE_PATH,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
} from "@/lib/site-metadata";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    absolute: SITE_TITLE,
  },
  description: SITE_DESCRIPTION,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "pt_BR",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: "/",
    images: [
      {
        url: DEFAULT_SOCIAL_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: DEFAULT_SOCIAL_IMAGE_ALT,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [DEFAULT_SOCIAL_IMAGE_PATH],
  },
};

export default async function HomePage() {
  const hotels = await getPublishedHotels();

  return (
    <div className="page-shell">
      <RevealObserver />
      <Header />

      <main id="top">
        <Hero />
        <HotelsCarousel hotels={hotels} />
        <ExperienceSection hotels={hotels} />
        <TestimonialsSection />
        <StayDetailsSection />
      </main>

      <Footer />
    </div>
  );
}
