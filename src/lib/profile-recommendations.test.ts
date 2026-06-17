import { describe, expect, it } from "vitest";

import {
  getProfileExperienceMatches,
  getProfileRecommendationHotelImage,
  normalizeLocationState,
  normalizeLocationText,
} from "@/lib/profile-recommendations";

const experience = {
  key: "recife",
  title: "Forró em Recife",
  location: "Recife, PE",
  reason: "Ritmo local perto da praia.",
  image: "/images/recife.jpg",
  alt: "Recife",
  query: "Recife",
  destinationCity: "Recife",
  destinationState: "PE",
};

describe("profile experience recommendations", () => {
  it("normaliza cidade e estado para comparacao geografica", () => {
    expect(normalizeLocationText("  São Paulo ")).toBe("sao paulo");
    expect(normalizeLocationText("Brasília")).toBe("brasilia");
    expect(normalizeLocationState(" pe ")).toBe("PE");
  });

  it("normaliza cidade/estado e prioriza somente hotéis da cidade exata", () => {
    const matches = getProfileExperienceMatches({
      recommendations: [experience],
      hotels: [
        {
          slug: "boa-viagem",
          name: "Boa Viagem",
          city: " recife ",
          state: "pe",
          coverImageUrl: "/boa-viagem.jpg",
        },
        {
          slug: "porto-de-galinhas",
          name: "Porto de Galinhas",
          city: "Ipojuca",
          state: "PE",
          coverImageUrl: "/porto.jpg",
        },
        {
          slug: "brasilia",
          name: "Brasília",
          city: "Brasília",
          state: "DF",
          coverImageUrl: "/brasilia.jpg",
        },
      ],
    });

    expect(matches[0].hotels).toHaveLength(1);
    expect(matches[0].hotel?.slug).toBe("boa-viagem");
    expect(matches[0].hotels[0].proximityLabel).toBe("Na mesma cidade");
  });

  it("aceita fallback somente no mesmo estado quando não há hotel na cidade", () => {
    const matches = getProfileExperienceMatches({
      recommendations: [experience],
      hotels: [
        {
          slug: "porto-de-galinhas",
          name: "Porto de Galinhas",
          city: "Ipojuca",
          state: "PE",
          coverImageUrl: "/porto.jpg",
        },
        {
          slug: "brasilia",
          name: "Brasília",
          city: "Brasília",
          state: "DF",
          coverImageUrl: "/brasilia.jpg",
        },
      ],
    });

    expect(matches[0].hotels.map(({ hotel }) => hotel.slug)).toEqual(["porto-de-galinhas"]);
    expect(matches[0].hotels[0].proximityLabel).toBe("No mesmo estado");
  });

  it("não recomenda hotéis despublicados nem experiências sem destino claro", () => {
    const matches = getProfileExperienceMatches({
      recommendations: [
        experience,
        {
          ...experience,
          key: "generica",
          title: "Momento especial",
          location: "",
          query: "Brasil",
          destinationCity: undefined,
          destinationState: undefined,
        },
      ],
      hotels: [
        {
          slug: "boa-viagem",
          name: "Boa Viagem",
          city: "Recife",
          state: "PE",
          coverImageUrl: "/boa-viagem.jpg",
          isPublished: false,
        },
      ],
    });

    expect(matches).toHaveLength(1);
    expect(matches[0].hotels).toEqual([]);
    expect(matches[0].hotel).toBeNull();
  });

  it("ignora hotel com slug inválido ao associar experiencia a hotel", () => {
    const matches = getProfileExperienceMatches({
      recommendations: [experience],
      hotels: [
        {
          slug: "../recife",
          name: "Slug inválido",
          city: "Recife",
          state: "PE",
          coverImageUrl: "/invalid.jpg",
        },
        {
          slug: "boa-viagem",
          name: "Boa Viagem",
          city: "Recife",
          state: "PE",
          coverImageUrl: "/boa-viagem.jpg",
        },
      ],
    });

    expect(matches[0].hotel?.slug).toBe("boa-viagem");
    expect(matches[0].href).toBe("/hoteis/boa-viagem");
  });

  it("usa coverImageUrl como primeira imagem do card e do modal", () => {
    const hotel = {
      slug: "pousada-casa-mare",
      name: "Pousada Casa Maré",
      city: "Recife",
      state: "PE",
      coverImageUrl: "https://cdn.example.test/casa-mare-cover.webp",
      images: [{ url: "https://cdn.example.test/casa-mare-gallery.webp", position: 0 }],
      rooms: [
        {
          imageUrl: "https://cdn.example.test/casa-mare-room-legacy.webp",
          images: [{ url: "https://cdn.example.test/casa-mare-room.webp", position: 0 }],
        },
      ],
    };

    const matches = getProfileExperienceMatches({
      recommendations: [experience],
      hotels: [hotel],
    });

    expect(matches[0].image).toBe("https://cdn.example.test/casa-mare-cover.webp");
    expect(getProfileRecommendationHotelImage(matches[0].hotels[0].hotel)).toBe(matches[0].image);
  });

  it("usa a primeira imagem da galeria quando o hotel nao tem capa", () => {
    const matches = getProfileExperienceMatches({
      recommendations: [experience],
      hotels: [
        {
          slug: "boa-viagem",
          name: "Boa Viagem",
          city: "Recife",
          state: "PE",
          coverImageUrl: " ",
          images: [
            { url: "https://cdn.example.test/gallery-2.webp", position: 2 },
            { url: "https://cdn.example.test/gallery-1.webp", position: 1 },
          ],
        },
      ],
    });

    expect(matches[0].image).toBe("https://cdn.example.test/gallery-1.webp");
  });

  it("usa imagem de quarto quando o hotel nao tem capa nem galeria", () => {
    const matches = getProfileExperienceMatches({
      recommendations: [experience],
      hotels: [
        {
          slug: "boa-viagem",
          name: "Boa Viagem",
          city: "Recife",
          state: "PE",
          coverImageUrl: "",
          images: [],
          rooms: [
            {
              imageUrl: "https://cdn.example.test/room-legacy.webp",
              images: [{ url: "https://cdn.example.test/room-gallery.webp", position: 0 }],
            },
          ],
        },
      ],
    });

    expect(matches[0].image).toBe("https://cdn.example.test/room-gallery.webp");
  });

  it("mantem fallback da experiencia quando o hotel realmente nao tem imagem", () => {
    const matches = getProfileExperienceMatches({
      recommendations: [experience],
      hotels: [
        {
          slug: "boa-viagem",
          name: "Boa Viagem",
          city: "Recife",
          state: "PE",
          coverImageUrl: "",
          images: [],
          rooms: [],
        },
      ],
    });

    expect(matches[0].image).toBe(experience.image);
    expect(getProfileRecommendationHotelImage(matches[0].hotels[0].hotel)).toBeNull();
  });
});
