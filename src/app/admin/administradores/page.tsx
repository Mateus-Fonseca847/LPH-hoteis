import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AdminAccessDenied } from "../AdminAccessDenied";
import { listAccessibleAdministratorsAction } from "../users/actions";
import { AdminUsersClient } from "./AdminUsersClient";

export default async function AdminAdministratorsPage() {
  let user;

  try {
    user = await requireAdminRouteSession("/admin/administradores");
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  const result = await listAccessibleAdministratorsAction();
  const manageableHotels =
    user.globalRole === "super_admin"
      ? await prisma.hotel.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : (
          await prisma.hotelPermission.findMany({
            where: {
              userId: user.id,
              role: { in: ["owner", "admin"] },
            },
            select: {
              role: true,
              hotel: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
            orderBy: { hotel: { name: "asc" } },
          })
        ).map((permission) => ({
          id: permission.hotel.id,
          name: permission.hotel.name,
          actorHotelRole: permission.role,
        }));
  const activationScopeHotelId =
    user.globalRole === "super_admin" ? (manageableHotels[0]?.id ?? null) : null;

  if (result.status === "error") {
    return (
      <section className="section admin-section admin-access-denied">
        <span className="hotel-page-eyebrow">Admin</span>
        <div className="section-heading admin-section-heading">
          <h1>Administradores</h1>
        </div>
        <p>{result.message}</p>
      </section>
    );
  }

  return (
    <AdminUsersClient
      actorGlobalRole={user.globalRole}
      initialAdministrators={result.administrators}
      activationScopeHotelId={activationScopeHotelId}
      manageableHotels={manageableHotels}
    />
  );
}
