import Link from "next/link";

import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AdminAuditPageProps = {
  searchParams: Promise<{
    action?: string;
    endDate?: string;
    hotelId?: string;
    page?: string;
    q?: string;
    startDate?: string;
    userId?: string;
  }>;
};

const pageSize = 25;

const auditActionLabels: Record<string, string> = {
  "hotel.profile.updated": "Perfil do hotel atualizado",
  "hotel.image.removed": "Imagem removida",
  "hotel.cover.uploaded": "Imagem de capa enviada",
  "hotel.gallery.uploaded": "Imagem de galeria enviada",
  "hotel.room.created": "Quarto criado",
  "hotel.room.updated": "Quarto atualizado",
  "hotel.room.activated": "Quarto ativado",
  "hotel.room.deactivated": "Quarto desativado",
  "hotel.room_rate.created": "Tarifa criada",
  "hotel.room_rate.updated": "Tarifa atualizada",
  "hotel.room_rate.activated": "Tarifa ativada",
  "hotel.room_rate.deactivated": "Tarifa desativada",
  "hotel.room_availability.updated": "Disponibilidade atualizada",
  "hotel.room_availability.bulk_upserted": "Disponibilidade atualizada em lote",
  "account.email_2fa.enabled": "2FA por e-mail ativado",
  "account.email_2fa.disabled": "2FA por e-mail desativado",
  "hotel.admin_user.created": "Administrador criado",
  "hotel.admin_user.activated": "Administrador ativado",
  "hotel.admin_user.deactivated": "Administrador desativado",
  "hotel.admin_permission.created": "Permissão criada",
  "hotel.admin_permission.updated": "Permissão atualizada",
  "hotel.admin_permission.removed": "Permissão removida",
};

function formatAuditAction(action: string) {
  return auditActionLabels[action] ?? action;
}

function formatAuditDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function getAuditEntity(action: string) {
  if (action.includes("room_availability")) {
    return "Disponibilidade";
  }

  if (action.includes("room_rate")) {
    return "Tarifa";
  }

  if (action.includes("room")) {
    return "Quarto";
  }

  if (action.includes("image") || action.includes("cover") || action.includes("gallery")) {
    return "Imagem";
  }

  if (action.includes("admin_user")) {
    return "Usuário administrativo";
  }

  if (action.includes("admin_permission")) {
    return "Permissão";
  }

  if (action.includes("email_2fa")) {
    return "SeguranÃ§a da conta";
  }

  if (action.includes("profile")) {
    return "Hotel";
  }

  return "Registro administrativo";
}

function getChangedFields(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function parsePage(value: string | undefined) {
  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return 1;
  }

  return parsed;
}

function parseDateFilter(value: string | undefined, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function buildPageHref(
  page: number,
  filters: {
    action: string;
    endDate: string;
    hotelId: string;
    q: string;
    startDate: string;
    userId: string;
  }
) {
  const params = new URLSearchParams();
  params.set("page", String(page));

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/admin/auditoria?${params.toString()}`;
}

export default async function AdminAuditPage({ searchParams }: AdminAuditPageProps) {
  const params = await searchParams;
  const currentPage = parsePage(params.page);
  const filters = {
    action: params.action?.trim() ?? "",
    endDate: params.endDate?.trim() ?? "",
    hotelId: params.hotelId?.trim() ?? "",
    q: params.q?.trim() ?? "",
    startDate: params.startDate?.trim() ?? "",
    userId: params.userId?.trim() ?? "",
  };
  let user;

  try {
    user = await requireAdminRouteSession("/admin/auditoria");
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  const scopedHotelIds =
    user.globalRole === "super_admin"
      ? null
      : (
          await prisma.hotelPermission.findMany({
            where: {
              userId: user.id,
            },
            select: {
              hotelId: true,
            },
          })
        ).map((permission) => permission.hotelId);

  const scopeWhere =
    scopedHotelIds === null
      ? {}
      : {
          hotelId: {
            in: scopedHotelIds,
          },
        };

  const hotelOptions = await prisma.hotel.findMany({
    where:
      scopedHotelIds === null
        ? {}
        : {
            id: {
              in: scopedHotelIds,
            },
          },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: "asc",
    },
  });
  const allowedHotelIds = new Set(hotelOptions.map((hotel) => hotel.id));
  const hasInvalidHotelFilter = Boolean(filters.hotelId && !allowedHotelIds.has(filters.hotelId));
  const selectedHotelId = hasInvalidHotelFilter ? "" : filters.hotelId;

  const startDate = parseDateFilter(filters.startDate);
  const endDate = parseDateFilter(filters.endDate, true);

  const where = {
    ...scopeWhere,
    ...(hasInvalidHotelFilter ? { hotelId: "__hotel_outside_scope__" } : {}),
    ...(selectedHotelId ? { hotelId: selectedHotelId } : {}),
    ...(filters.userId ? { userId: filters.userId } : {}),
    ...(filters.action ? { action: filters.action } : {}),
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
            { action: { contains: filters.q, mode: "insensitive" as const } },
            { ipAddress: { contains: filters.q, mode: "insensitive" as const } },
            { hotel: { name: { contains: filters.q, mode: "insensitive" as const } } },
            { user: { name: { contains: filters.q, mode: "insensitive" as const } } },
            { user: { email: { contains: filters.q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [logs, totalLogs, userOptionsRows, actionOptionsRows] = await prisma.$transaction([
    prisma.hotelAuditLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      skip: (currentPage - 1) * pageSize,
      take: pageSize,
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
    prisma.hotelAuditLog.count({ where }),
    prisma.hotelAuditLog.findMany({
      where: scopeWhere,
      distinct: ["userId"],
      select: {
        userId: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        userId: "asc",
      },
    }),
    prisma.hotelAuditLog.findMany({
      where: scopeWhere,
      distinct: ["action"],
      select: {
        action: true,
      },
      orderBy: {
        action: "asc",
      },
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(totalLogs / pageSize));

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Admin</span>
        <h1>Auditoria</h1>
        <p className="admin-rooms-copy">
          Consulte alterações administrativas registradas dentro do seu escopo.
        </p>
      </div>

      <div className="admin-overview-grid">
        <article className="hotel-content-card admin-overview-card">
          <span>Registros</span>
          <strong>{totalLogs}</strong>
          <p>Eventos administrativos visíveis para o seu usuário.</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Escopo</span>
          <strong>{user.globalRole === "super_admin" ? "Rede" : "Hotéis vinculados"}</strong>
          <p>
            {user.globalRole === "super_admin"
              ? "Exibindo logs de todos os hotéis."
              : `${scopedHotelIds?.length ?? 0} hotel(is) no seu escopo.`}
          </p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Página atual</span>
          <strong>
            {currentPage}/{totalPages}
          </strong>
          <p>Ordenação por registros mais recentes.</p>
        </article>
      </div>

      <form action="/admin/auditoria" className="admin-form-section admin-audit-filters">
        <div className="admin-form-grid admin-form-grid--three">
          <label className="admin-form-field">
            <span>Hotel</span>
            <select name="hotelId" defaultValue={selectedHotelId}>
              <option value="">Todos os hotéis</option>
              {hotelOptions.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-form-field">
            <span>Usuário</span>
            <select name="userId" defaultValue={filters.userId}>
              <option value="">Todos os usuários</option>
              {userOptionsRows.map((row) => (
                <option key={row.userId} value={row.userId}>
                  {row.user.name || row.user.email}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-form-field">
            <span>Tipo de ação</span>
            <select name="action" defaultValue={filters.action}>
              <option value="">Todas as ações</option>
              {actionOptionsRows.map((row) => (
                <option key={row.action} value={row.action}>
                  {formatAuditAction(row.action)}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-form-field">
            <span>Data inicial</span>
            <input name="startDate" type="date" defaultValue={filters.startDate} />
          </label>

          <label className="admin-form-field">
            <span>Data final</span>
            <input name="endDate" type="date" defaultValue={filters.endDate} />
          </label>

          <label className="admin-form-field">
            <span>Texto livre</span>
            <input
              name="q"
              type="search"
              defaultValue={filters.q}
              placeholder="Ação, usuário, hotel ou IP"
            />
          </label>
        </div>

        <div className="admin-room-actions admin-audit-filter-actions">
          <button type="submit" className="card-cta-button admin-edit-button">
            Filtrar
          </button>
          <Link href="/admin/auditoria" className="admin-secondary-button">
            Limpar filtros
          </Link>
        </div>
      </form>

      {logs.length === 0 ? (
        <div className="hotel-empty-state admin-history-empty">
          <strong>Nenhum log encontrado.</strong>
          <p>Quando houver alterações administrativas no seu escopo, elas aparecerão aqui.</p>
        </div>
      ) : (
        <div className="admin-history-list admin-audit-list">
          {logs.map((log) => {
            const changedFields = getChangedFields(log.changedFields);

            return (
              <article key={log.id} className="admin-history-item admin-audit-item">
                <div className="admin-history-item-top">
                  <div>
                    <strong>{formatAuditAction(log.action)}</strong>
                    <p>{log.user.name || log.user.email}</p>
                  </div>
                  <span>{formatAuditDate(log.createdAt)}</span>
                </div>

                <div className="admin-audit-meta">
                  <p>
                    <span>Hotel</span>
                    <strong>{log.hotel.name}</strong>
                  </p>
                  <p>
                    <span>Entidade</span>
                    <strong>{getAuditEntity(log.action)}</strong>
                  </p>
                  <p>
                    <span>IP</span>
                    <strong>{log.ipAddress || "Não informado"}</strong>
                  </p>
                </div>

                <div className="admin-history-fields">
                  {changedFields.length > 0 ? (
                    changedFields.map((field) => (
                      <span key={`${log.id}-${field}`} className="admin-history-tag">
                        {field}
                      </span>
                    ))
                  ) : (
                    <span className="admin-history-tag">Sem campos detalhados</span>
                  )}
                </div>

                <Link href={`/admin/auditoria/${log.id}`} className="admin-audit-detail-link">
                  Ver detalhes
                </Link>
              </article>
            );
          })}
        </div>
      )}

      <nav className="admin-audit-pagination" aria-label="Paginação da auditoria">
        <Link
          href={buildPageHref(Math.max(1, currentPage - 1), {
            ...filters,
            hotelId: selectedHotelId,
          })}
          className="admin-secondary-button"
          aria-disabled={currentPage <= 1}
        >
          Anterior
        </Link>
        <span>
          Página {currentPage} de {totalPages}
        </span>
        <Link
          href={buildPageHref(Math.min(totalPages, currentPage + 1), {
            ...filters,
            hotelId: selectedHotelId,
          })}
          className="admin-secondary-button"
          aria-disabled={currentPage >= totalPages}
        >
          Próxima
        </Link>
      </nav>
    </section>
  );
}
