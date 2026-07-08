import { describe, expect, it } from "vitest";

import { PUBLIC_HOTEL_WHERE } from "./public-hotel";

describe("PUBLIC_HOTEL_WHERE", () => {
  it("mantém filtro público compatível com bancos sem coluna de arquivamento", () => {
    expect(PUBLIC_HOTEL_WHERE).toEqual({
      isPublished: true,
    });
  });
});
