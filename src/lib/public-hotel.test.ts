import { describe, expect, it } from "vitest";

import { PUBLIC_HOTEL_WHERE } from "./public-hotel";

describe("PUBLIC_HOTEL_WHERE", () => {
  it("mantem rascunhos fora do site publico e do mapa", () => {
    expect(PUBLIC_HOTEL_WHERE).toEqual({
      isPublished: true,
    });
  });
});
