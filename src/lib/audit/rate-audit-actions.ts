export const HOTEL_RATE_AUDIT_ACTIONS = [
  "hotel.room_rate.created",
  "hotel.room_rate.updated",
  "hotel.room_rate.activated",
  "hotel.room_rate.deactivated",
  "hotel.room_rate.removed",
] as const;

export function isHotelRateAuditAction(action: string) {
  return (HOTEL_RATE_AUDIT_ACTIONS as readonly string[]).includes(action);
}
