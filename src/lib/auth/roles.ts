export type GlobalRole = "super_admin" | "hotel_admin" | "user";

export function isAdminUserRole(role: GlobalRole) {
  return role === "super_admin" || role === "hotel_admin";
}
