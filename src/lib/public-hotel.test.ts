import { describe, expect, it } from "vitest";

import { PUBLIC_HOTEL_WHERE } from "./public-hotel";

describe("PUBLIC_HOTEL_WHERE", () => {
  it("publica apenas hotéis publicados e não arquivados", () => {
    expect(PUBLIC_HOTEL_WHERE).toEqual({
      isPublished: true,
      isArchived: false,
    });
  });
});
