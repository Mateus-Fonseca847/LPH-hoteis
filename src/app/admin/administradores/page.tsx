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

  if (user.globalRole !== "super_admin") {
    return (
      <AdminAccessDenied
        title="Acesso restrito"
        description="Somente o super administrador pode definir quais hotéis cada administrador do hotel gerencia."
      />
    );
  }

  const result = await listAccessibleAdministratorsAction();
  const manageableHotels = await prisma.hotel.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const activationScopeHotelId = manageableHotels[0]?.id ?? null;

  if (result.status === "error") {
    return (
      <section className="section admin-section admin-access-denied">
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
