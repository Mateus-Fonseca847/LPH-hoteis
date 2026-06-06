import type { Prisma } from "@prisma/client";

import { HOTEL_RATE_AUDIT_ACTIONS, isHotelRateAuditAction } from "@/lib/audit/rate-audit-actions";

export type RateAuditFilters = {
  action: string;
  endDate: string;
  hotelId: string;
  q: string;
  startDate: string;
  userId: string;
};

type BuildRateAuditWhereInput = {
  endDate: Date | null;
  filters: RateAuditFilters;
  hasInvalidHotelFilter: boolean;
  scopedHotelIds: string[] | null;
  selectedHotelId: string;
  startDate: Date | null;
};

export function buildRateAuditScopeWhere(scopedHotelIds: string[] | null) {
  return scopedHotelIds === null
    ? {}
    : {
        hotelId: {
          in: scopedHotelIds,
        },
      };
}

export function buildRateAuditWhere({
  endDate,
  filters,
  hasInvalidHotelFilter,
  scopedHotelIds,
  selectedHotelId,
  startDate,
}: BuildRateAuditWhereInput): Prisma.HotelAuditLogWhereInput {
  const selectedAction =
    filters.action && isHotelRateAuditAction(filters.action) ? filters.action : "";
  const hasInvalidActionFilter = Boolean(filters.action && !selectedAction);

  return {
    ...buildRateAuditScopeWhere(scopedHotelIds),
    action: hasInvalidActionFilter
      ? "__rate_audit_action_outside_scope__"
      : selectedAction || { in: [...HOTEL_RATE_AUDIT_ACTIONS] },
    ...(hasInvalidHotelFilter ? { hotelId: "__hotel_outside_scope__" } : {}),
    ...(selectedHotelId ? { hotelId: selectedHotelId } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(startDate || endDate
      ? {
          createdAt: {
            ...(startDate ? { gte: startDate } : {}),
            ...(endDate ? { lte: endDate } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { action: { contains: filters.q, mode: "insensitive" } },
            { ipAddress: { contains: filters.q, mode: "insensitive" } },
            { hotel: { name: { contains: filters.q, mode: "insensitive" } } },
            { user: { name: { contains: filters.q, mode: "insensitive" } } },
            { user: { email: { contains: filters.q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };
}
