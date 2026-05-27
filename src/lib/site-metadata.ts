export const SITE_NAME = "LPH Hotéis";
export const SITE_TITLE = "LPH Hotéis | Hospedagens e experiências pelo Brasil";
export const SITE_DESCRIPTION =
  "Descubra hotéis selecionados, experiências memoráveis e consulte sua estadia com a curadoria da LPH Hotéis.";
export const DEFAULT_SOCIAL_IMAGE_PATH = "/opengraph-image";

export function getSiteUrl() {
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();

  try {
    return new URL(configuredUrl || "http://localhost:3000");
  } catch {
    return new URL("http://localhost:3000");
  }
}
