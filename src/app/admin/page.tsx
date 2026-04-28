import Link from "next/link";

import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AdminAccessDenied } from "./AdminAccessDenied";

function formatRole(role: string) {
  return role === "super_admin" ? "Super admin" : "Admin de hotel";
}

export default async function AdminHomePage() {
  let user;

  try {
    user = await requireAdminRouteSession("/admin");
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  const hotelPermissions =
    user.globalRole === "super_admin"
      ? []
      : await prisma.hotelPermission.findMany({
          where: {
            userId: user.id,
          },
          select: {
            hotelId: true,
          },
        });

  const scopedHotelIds =
    user.globalRole === "super_admin"
      ? null
      : Array.from(new Set(hotelPermissions.map((permission) => permission.hotelId)));
  const hotelScope = scopedHotelIds === null ? {} : { id: { in: scopedHotelIds } };

  const [totalHotels, publishedHotels, activeAdmins] = await prisma.$transaction([
    prisma.hotel.count({
      where: hotelScope,
    }),
    prisma.hotel.count({
      where: {
        ...hotelScope,
        isPublished: true,
      },
    }),
    prisma.user.count({
      where: {
        isActive: true,
        globalRole: {
          in: ["super_admin", "hotel_admin"],
        },
      },
    }),
  ]);

  const isSuperAdmin = user.globalRole === "super_admin";

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Admin</span>
        <h1>Painel operacional</h1>
        <p className="admin-rooms-copy">
          {isSuperAdmin
            ? "Visão consolidada da rede LPH."
            : "Visão limitada aos hotéis vinculados ao seu usuário."}
        </p>
      </div>

      <div className="admin-dashboard-hero">
        <article className="hotel-content-card admin-dashboard-profile">
          <span>Perfil</span>
          <strong>{user.name}</strong>
          <p>{user.email}</p>
          <small>{formatRole(user.globalRole)}</small>
        </article>

        <Link
          href="/admin/hoteis"
          className="hotel-content-card admin-overview-card admin-link-card"
        >
          <span>Hotéis</span>
          <strong>Gerenciar unidades</strong>
          <p>Editar perfis, quartos, tarifas e disponibilidade.</p>
        </Link>

        <Link
          href="/admin/auditoria"
          className="hotel-content-card admin-overview-card admin-link-card"
        >
          <span>Auditoria</span>
          <strong>Ver registros</strong>
          <p>Consultar histórico administrativo dentro do seu escopo.</p>
        </Link>
      </div>

      <div className="admin-dashboard-metrics">
        <article className="hotel-content-card admin-dashboard-metric">
          <span>{isSuperAdmin ? "Total de hotéis" : "Hotéis acessíveis"}</span>
          <strong>{totalHotels}</strong>
          <p>
            {isSuperAdmin ? "Unidades cadastradas na rede." : "Unidades vinculadas ao seu usuário."}
          </p>
        </article>

        <article className="hotel-content-card admin-dashboard-metric">
          <span>Publicados</span>
          <strong>{publishedHotels}</strong>
          <p>
            {isSuperAdmin
              ? "Hotéis visíveis no site público."
              : "Hotéis do seu escopo visíveis no site público."}
          </p>
        </article>

        <article className="hotel-content-card admin-dashboard-metric">
          <span>Admins ativos</span>
          <strong>{activeAdmins}</strong>
          <p>Usuários administrativos ativos.</p>
        </article>
      </div>
    </section>
  );
}
