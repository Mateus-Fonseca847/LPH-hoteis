export const SITE_NAME = "LPH Hotéis";
export const SITE_TITLE = "LPH Hotéis | Hospedagens selecionadas pelo Brasil";
export const SITE_DESCRIPTION =
  "Encontre hotéis selecionados pela LPH Hotéis, explore experiências pelo Brasil e consulte disponibilidade para sua próxima estadia.";
export const DEFAULT_SOCIAL_IMAGE_PATH = "/opengraph-image";
export const DEFAULT_SOCIAL_IMAGE_ALT =
  "LPH Hotéis - hospedagens selecionadas e experiências pelo Brasil";
export const SITE_KEYWORDS = [
  "LPH Hotéis",
  "hotéis no Brasil",
  "hospedagens selecionadas",
  "consultar disponibilidade",
  "experiências de viagem",
];

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  try {
    return new URL(configuredUrl || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}
