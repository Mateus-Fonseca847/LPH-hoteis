import { describe, expect, it } from "vitest";

import { HOTEL_RATE_AUDIT_ACTIONS } from "@/lib/audit/rate-audit-actions";

import {
  buildRateAuditScopeWhere,
  buildRateAuditWhere,
  type RateAuditFilters,
} from "./rate-audit-query";

const emptyFilters: RateAuditFilters = {
  action: "",
  endDate: "",
  hotelId: "",
  q: "",
  startDate: "",
  userId: "",
};

describe("buildRateAuditWhere", () => {
  it("filtra sempre por ações de tarifa", () => {
    expect(
      buildRateAuditWhere({
        endDate: null,
        filters: emptyFilters,
        hasInvalidHotelFilter: false,
        scopedHotelIds: null,
        selectedHotelId: "",
        startDate: null,
      })
    ).toMatchObject({
      action: {
        in: [...HOTEL_RATE_AUDIT_ACTIONS],
      },
    });
  });

  it("rejeita ações que não são de tarifa", () => {
    expect(
      buildRateAuditWhere({
        endDate: null,
        filters: {
          ...emptyFilters,
          action: "hotel.profile.updated",
        },
        hasInvalidHotelFilter: false,
        scopedHotelIds: null,
        selectedHotelId: "",
        startDate: null,
      })
    ).toMatchObject({
      action: "__rate_audit_action_outside_scope__",
    });
  });

  it("mantém escopo de hotel_admin", () => {
    expect(buildRateAuditScopeWhere(["hotel-1", "hotel-2"])).toEqual({
      hotelId: {
        in: ["hotel-1", "hotel-2"],
      },
    });
  });

  it("permite super_admin sem escopo de hotel", () => {
    expect(buildRateAuditScopeWhere(null)).toEqual({});
  });
});
