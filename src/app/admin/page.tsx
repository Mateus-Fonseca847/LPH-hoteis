import Link from "next/link";

import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AdminAccessDenied } from "./AdminAccessDenied";

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

  const visibleHotelsCount =
    user.globalRole === "super_admin"
      ? await prisma.hotel.count()
      : await prisma.hotelPermission.count({
          where: {
            userId: user.id,
          },
        });

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Admin</span>
        <h1>Painel administrativo</h1>
      </div>

      <div className="admin-overview-grid">
        <article className="hotel-content-card admin-overview-card">
          <span>Perfil</span>
          <strong>{user.name}</strong>
          <p>{user.email}</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Papel global</span>
          <strong>{user.globalRole === "super_admin" ? "Super admin" : "Admin de hotel"}</strong>
          <p>{visibleHotelsCount} hotéis visíveis na administração.</p>
        </article>

        <Link
          href="/admin/hoteis"
          className="hotel-content-card admin-overview-card admin-link-card"
        >
          <span>Hotéis</span>
          <strong>Gerenciar hotéis</strong>
          <p>Ver lista permitida e acessar cada unidade.</p>
        </Link>
      </div>
    </section>
  );
}
