import Link from "next/link";

import {
  calculateHotelCompleteness,
  getHotelCompletenessSelect,
} from "@/lib/admin/hotel-completeness";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AdminAccessDenied } from "./AdminAccessDenied";

type ActionableAlert = {
  description: string;
  href: string;
  title: string;
};

function formatAuditDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function formatRole(role: string) {
  return role === "super_admin" ? "Super admin" : "Admin de hotel";
}

function formatAction(action: string) {
  const labels: Record<string, string> = {
    "hotel.profile.updated": "Perfil atualizado",
    "hotel.cover.uploaded": "Imagem de capa enviada",
    "hotel.gallery.uploaded": "Imagem de galeria enviada",
    "hotel.image.removed": "Imagem removida",
    "hotel.room.created": "Quarto criado",
    "hotel.room.updated": "Quarto atualizado",
    "hotel.room.activated": "Quarto ativado",
    "hotel.room.deactivated": "Quarto desativado",
    "hotel.room_rate.created": "Tarifa criada",
    "hotel.room_rate.updated": "Tarifa atualizada",
    "hotel.room_rate.activated": "Tarifa ativada",
    "hotel.room_rate.deactivated": "Tarifa desativada",
    "hotel.room_availability.bulk_upserted": "Disponibilidade atualizada",
    "hotel.admin_user.created": "Administrador criado",
    "hotel.admin_user.activated": "Administrador ativado",
    "hotel.admin_user.deactivated": "Administrador desativado",
    "hotel.admin_permission.created": "Permissão criada",
    "hotel.admin_permission.updated": "Permissão atualizada",
    "hotel.admin_permission.removed": "Permissão removida",
  };

  return labels[action] ?? action;
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

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const hotelPermissions =
    user.globalRole === "super_admin"
      ? []
      : await prisma.hotelPermission.findMany({
          where: {
            userId: user.id,
          },
          select: {
            hotelId: true,
            role: true,
          },
        });

  const scopedHotelIds =
    user.globalRole === "super_admin"
      ? null
      : Array.from(new Set(hotelPermissions.map((permission) => permission.hotelId)));
  const manageableHotelIds =
    user.globalRole === "super_admin"
      ? null
      : Array.from(
          new Set(
            hotelPermissions
              .filter((permission) => permission.role === "owner" || permission.role === "admin")
              .map((permission) => permission.hotelId)
          )
        );

  const hotelScope = scopedHotelIds === null ? {} : { id: { in: scopedHotelIds } };
  const roomScope = scopedHotelIds === null ? {} : { hotelId: { in: scopedHotelIds } };
  const rateScope = scopedHotelIds === null ? {} : { room: { hotelId: { in: scopedHotelIds } } };
  const availabilityScope =
    scopedHotelIds === null ? {} : { room: { hotelId: { in: scopedHotelIds } } };
  const auditScope = scopedHotelIds === null ? {} : { hotelId: { in: scopedHotelIds } };
  const completenessSelect = getHotelCompletenessSelect(today);

  const [
    totalHotels,
    publishedHotels,
    unpublishedHotels,
    activeRooms,
    activeRates,
    futureAvailability,
    activeAdmins,
    latestLogs,
    completenessHotelRows,
    hotelsWithoutCover,
    hotelsWithoutActiveRoomsRows,
    roomsWithoutActiveRates,
    hotelsWithoutFutureAvailabilityRows,
    unpublishedHotelRows,
    adminsWithoutTwoFactor,
  ] = await prisma.$transaction([
    prisma.hotel.count({
      where: hotelScope,
    }),
    prisma.hotel.count({
      where: {
        ...hotelScope,
        isPublished: true,
      },
    }),
    prisma.hotel.count({
      where: {
        ...hotelScope,
        isPublished: false,
      },
    }),
    prisma.hotelRoom.count({
      where: {
        ...roomScope,
        isActive: true,
      },
    }),
    prisma.roomRate.count({
      where: {
        ...rateScope,
        isActive: true,
      },
    }),
    prisma.roomAvailability.count({
      where: {
        ...availabilityScope,
        date: {
          gte: today,
        },
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
    prisma.hotelAuditLog.findMany({
      where: auditScope,
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
      include: {
        hotel: {
          select: {
            name: true,
          },
        },
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
    prisma.hotel.findMany({
      where: hotelScope,
      select: {
        id: true,
        city: true,
        state: true,
        ...completenessSelect,
      },
      orderBy: {
        name: "asc",
      },
    }),
    prisma.hotel.findMany({
      where: {
        ...hotelScope,
        OR: [{ coverImageUrl: "" }, { coverImageUrl: { equals: "" } }],
      },
      select: {
        id: true,
        name: true,
      },
      take: 5,
      orderBy: {
        name: "asc",
      },
    }),
    prisma.hotel.findMany({
      where: {
        ...hotelScope,
        rooms: {
          none: {
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      take: 5,
      orderBy: {
        name: "asc",
      },
    }),
    prisma.hotelRoom.findMany({
      where: {
        ...roomScope,
        isActive: true,
        rates: {
          none: {
            isActive: true,
          },
        },
      },
      select: {
        name: true,
        hotel: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      take: 5,
      orderBy: {
        updatedAt: "desc",
      },
    }),
    prisma.hotel.findMany({
      where: {
        ...hotelScope,
        rooms: {
          some: {
            isActive: true,
          },
        },
        NOT: {
          rooms: {
            some: {
              isActive: true,
              availability: {
                some: {
                  date: {
                    gte: today,
                  },
                  closed: false,
                  availableUnits: {
                    gt: 0,
                  },
                },
              },
            },
          },
        },
      },
      select: {
        id: true,
        name: true,
      },
      take: 5,
      orderBy: {
        name: "asc",
      },
    }),
    prisma.hotel.findMany({
      where: {
        ...hotelScope,
        isPublished: false,
      },
      select: {
        id: true,
        name: true,
      },
      take: 5,
      orderBy: {
        name: "asc",
      },
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        globalRole: {
          in: ["super_admin", "hotel_admin"],
        },
        twoFactorEnabled: false,
        ...(user.globalRole === "super_admin"
          ? {}
          : {
              hotelPermissions: {
                some: {
                  hotelId: {
                    in: manageableHotelIds ?? [],
                  },
                },
              },
            }),
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
      take: 5,
      orderBy: {
        name: "asc",
      },
    }),
  ]);

  const incompleteHotels = completenessHotelRows
    .map((hotel) => ({
      city: hotel.city,
      id: hotel.id,
      name: hotel.name,
      state: hotel.state,
      ...calculateHotelCompleteness(hotel),
    }))
    .filter((hotel) => hotel.percentage < 100)
    .sort((current, next) => current.percentage - next.percentage);

  const alerts: ActionableAlert[] = [
    ...hotelsWithoutCover.map((hotel) => ({
      title: "Hotel sem imagem de capa",
      description: `${hotel.name} precisa de uma imagem principal.`,
      href: `/admin/hoteis/${hotel.id}`,
    })),
    ...hotelsWithoutActiveRoomsRows.map((hotel) => ({
      title: "Hotel sem quartos ativos",
      description: `${hotel.name} precisa de quartos ativos.`,
      href: `/admin/hoteis/${hotel.id}`,
    })),
    ...roomsWithoutActiveRates.map((room) => ({
      title: "Quarto sem tarifa ativa",
      description: `${room.hotel.name}: ${room.name} precisa de tarifa ativa.`,
      href: `/admin/hoteis/${room.hotel.id}`,
    })),
    ...hotelsWithoutFutureAvailabilityRows.map((hotel) => ({
      title: "Hotel sem disponibilidade futura",
      description: `${hotel.name} precisa de disponibilidade aberta.`,
      href: `/admin/hoteis/${hotel.id}`,
    })),
    ...unpublishedHotelRows.map((hotel) => ({
      title: "Hotel despublicado",
      description: `${hotel.name} não aparece no site público.`,
      href: `/admin/hoteis/${hotel.id}`,
    })),
    ...incompleteHotels.slice(0, 5).map((hotel) => ({
      title: "Perfil incompleto",
      description: `${hotel.name} está com ${hotel.percentage}% de completude.`,
      href: `/admin/hoteis/${hotel.id}`,
    })),
    ...adminsWithoutTwoFactor.map((admin) => ({
      title: "Admin sem 2FA ativo",
      description: `${admin.name || admin.email} ainda não ativou o segundo fator.`,
      href: "/admin/administradores",
    })),
  ];

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
        {isSuperAdmin ? (
          <>
            <article className="hotel-content-card admin-dashboard-metric">
              <span>Total de hotéis</span>
              <strong>{totalHotels}</strong>
              <p>Unidades cadastradas na rede.</p>
            </article>
            <article className="hotel-content-card admin-dashboard-metric">
              <span>Publicados</span>
              <strong>{publishedHotels}</strong>
              <p>Hotéis visíveis no site público.</p>
            </article>
            <article className="hotel-content-card admin-dashboard-metric">
              <span>Despublicados</span>
              <strong>{unpublishedHotels}</strong>
              <p>Unidades ocultas da área pública.</p>
            </article>
            <article className="hotel-content-card admin-dashboard-metric">
              <span>Admins ativos</span>
              <strong>{activeAdmins}</strong>
              <p>Usuários administrativos ativos.</p>
            </article>
          </>
        ) : (
          <article className="hotel-content-card admin-dashboard-metric">
            <span>Hotéis acessíveis</span>
            <strong>{totalHotels}</strong>
            <p>Unidades vinculadas ao seu usuário.</p>
          </article>
        )}

        <article className="hotel-content-card admin-dashboard-metric">
          <span>Quartos ativos</span>
          <strong>{activeRooms}</strong>
          <p>Quartos disponíveis para exibição e operação.</p>
        </article>

        <article className="hotel-content-card admin-dashboard-metric">
          <span>Tarifas ativas</span>
          <strong>{activeRates}</strong>
          <p>Tarifas publicadas nos quartos ativos.</p>
        </article>

        <article className="hotel-content-card admin-dashboard-metric">
          <span>Disponibilidade futura</span>
          <strong>{futureAvailability}</strong>
          <p>Registros cadastrados a partir de hoje.</p>
        </article>
      </div>

      <div className="admin-dashboard-grid">
        <section className="hotel-content-card admin-dashboard-panel">
          <div className="admin-subsection-heading">
            <h2>Últimos logs</h2>
          </div>

          {latestLogs.length === 0 ? (
            <div className="hotel-empty-state admin-history-empty">
              <strong>Nenhum log encontrado.</strong>
              <p>As alterações administrativas aparecerão aqui.</p>
            </div>
          ) : (
            <div className="admin-history-list">
              {latestLogs.map((log) => (
                <article key={log.id} className="admin-history-item">
                  <div className="admin-history-item-top">
                    <div>
                      <strong>{formatAction(log.action)}</strong>
                      <p>{log.hotel.name}</p>
                    </div>
                    <span>{formatAuditDate(log.createdAt)}</span>
                  </div>
                  <div className="admin-dashboard-log-footer">
                    <span>{log.user.name || log.user.email}</span>
                    <Link href={`/admin/auditoria/${log.id}`}>Detalhes</Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="hotel-content-card admin-dashboard-panel">
          <div className="admin-subsection-heading">
            <h2>{isSuperAdmin ? "Alertas da rede" : "Alertas operacionais"}</h2>
          </div>

          {alerts.length === 0 ? (
            <div className="hotel-empty-state admin-history-empty">
              <strong>Sem alertas críticos.</strong>
              <p>Não há pendências operacionais relevantes no escopo atual.</p>
            </div>
          ) : (
            <div className="admin-dashboard-alerts">
              {alerts.slice(0, 12).map((alert) => (
                <Link
                  key={`${alert.title}-${alert.description}`}
                  href={alert.href}
                  className="admin-dashboard-alert"
                >
                  <strong>{alert.title}</strong>
                  <p>{alert.description}</p>
                  <span>Resolver</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="hotel-content-card admin-dashboard-panel">
        <div className="admin-subsection-heading">
          <h2>Completude dos hotéis</h2>
        </div>

        {incompleteHotels.length === 0 ? (
          <div className="hotel-empty-state admin-history-empty">
            <strong>Todos os perfis estão completos.</strong>
            <p>Os hotéis do seu escopo possuem os dados operacionais essenciais.</p>
          </div>
        ) : (
          <div className="admin-dashboard-completeness-list">
            {incompleteHotels.slice(0, 6).map((hotel) => (
              <article key={hotel.id} className="admin-dashboard-completeness-item">
                <div>
                  <strong>{hotel.name}</strong>
                  <p>
                    {hotel.city}, {hotel.state}
                  </p>
                  <small>Pendências: {hotel.pending.slice(0, 4).join(", ")}</small>
                </div>
                <span>{hotel.percentage}%</span>
              </article>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
