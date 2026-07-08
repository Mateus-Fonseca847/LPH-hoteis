import Link from "next/link";

import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AdminAccessDenied } from "./AdminAccessDenied";

function formatRole(role: string) {
  return role === "super_admin" ? "Super administrador" : "Administrador do hotel";
}

const overviewCards = [
  {
    href: "/admin/hoteis",
    label: "Hotéis",
    title: "Gerenciar unidades",
    description: "Editar perfis, quartos, tarifas e disponibilidade.",
    action: "Abrir hotéis",
  },
  {
    href: "/admin/auditoria",
    superAdminOnly: true,
    label: "Auditoria",
    title: "Auditoria",
    description: "Consulte alterações feitas nas tarifas dos hotéis.",
    action: "Abrir auditoria",
  },
  {
    href: "/admin/financeiro",
    superAdminOnly: true,
    heading: "Painel financeiro",
    label: "Financeiro",
    title: "Movimentações",
    description: "Acompanhe reservas pagas, receita da plataforma e repasses por hotel.",
    action: "Ver dashboard financeiro",
  },
  {
    href: "/admin/reservas",
    label: "Reservas",
    title: "Acompanhar pagamentos",
    description: "Consulte reservas, status de pagamento e dados operacionais.",
    action: "Ver reservas",
  },
];

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

  const [totalHotels, publishedHotels] = await prisma.$transaction([
    prisma.hotel.count({
      where: hotelScope,
    }),
    prisma.hotel.count({
      where: {
        ...hotelScope,
        isPublished: true,
      },
    }),
  ]);

  const isSuperAdmin = user.globalRole === "super_admin";
  const visibleOverviewCards = isSuperAdmin
    ? [
        ...overviewCards,
        {
          href: "/admin/solicitacoes-acesso",
          label: "Acessos",
          title: "Solicitações de acesso",
          description: "Analise pedidos de donos de hotéis.",
          action: "Ver solicitações",
        },
      ]
    : overviewCards.filter((card) => !card.superAdminOnly);
  const scopedAdminHotelIds = scopedHotelIds ?? [];
  const activeAdmins = isSuperAdmin
    ? await prisma.user.count({
        where: {
          isActive: true,
          globalRole: {
            in: ["super_admin", "hotel_admin"],
          },
        },
      })
    : scopedAdminHotelIds.length
      ? await prisma.user.count({
          where: {
            isActive: true,
            globalRole: "hotel_admin",
            hotelPermissions: {
              some: {
                hotelId: {
                  in: scopedAdminHotelIds,
                },
              },
            },
          },
        })
      : 0;

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <h1>Painel operacional</h1>
        <p className="admin-rooms-copy">
          {isSuperAdmin
            ? "Visão consolidada da rede LPH."
            : "Visão limitada aos hotéis vinculados ao seu usuário."}
        </p>
      </div>

      <div className="admin-dashboard-actions">
        <Link href="/admin/hoteis/novo" className="admin-primary-create-button">
          Adicionar hotel
        </Link>
      </div>

      <div className="admin-dashboard-hero">
        <article className="hotel-content-card admin-dashboard-profile admin-identity-card">
          <div className="admin-identity-card__head">
            <span>Perfil</span>
          </div>
          <div className="admin-identity-card__body">
            <strong>{user.name}</strong>
            <p>{user.email}</p>
          </div>
          <small>{formatRole(user.globalRole)}</small>
        </article>

        {visibleOverviewCards.map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="hotel-content-card admin-overview-card admin-link-card admin-identity-card"
          >
            <div className="admin-identity-card__head">
              <span>{card.label}</span>
            </div>
            <div className="admin-identity-card__body">
              <strong>{card.heading ?? card.title}</strong>
              <p>{card.description}</p>
            </div>
            <small>{card.action}</small>
          </Link>
        ))}
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
