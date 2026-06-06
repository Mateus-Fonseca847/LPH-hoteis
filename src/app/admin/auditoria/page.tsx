import Link from "next/link";

import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { HOTEL_RATE_AUDIT_ACTIONS } from "@/lib/audit/rate-audit-actions";
import { prisma } from "@/lib/prisma";

import { buildRateAuditScopeWhere, buildRateAuditWhere } from "./rate-audit-query";

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
  "hotel.room_rate.created": "Tarifa criada",
  "hotel.room_rate.updated": "Tarifa atualizada",
  "hotel.room_rate.activated": "Tarifa ativada",
  "hotel.room_rate.deactivated": "Tarifa desativada",
  "hotel.room_rate.removed": "Tarifa removida",
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

function getChangedFields(value: unknown) {
  return Array.isArray(value) ? value.map(String) : [];
}

function getAuditValueObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getFirstText(...values: unknown[]) {
  const value = values.find((item) => typeof item === "string" && item.trim());
  return typeof value === "string" ? value : "";
}

function formatBooleanValue(value: unknown) {
  if (typeof value !== "boolean") {
    return "";
  }

  return value ? "Ativa" : "Inativa";
}

function formatCurrencyValue(cents: unknown, currency: unknown) {
  if (typeof cents !== "number") {
    return "";
  }

  return new Intl.NumberFormat("pt-BR", {
    currency: typeof currency === "string" ? currency : "BRL",
    style: "currency",
  }).format(cents / 100);
}

function getRateAuditSummary(previousValue: unknown, newValue: unknown) {
  const previous = getAuditValueObject(previousValue);
  const next = getAuditValueObject(newValue);
  const previousPrice = formatCurrencyValue(
    previous.priceCents,
    previous.currency ?? next.currency
  );
  const nextPrice = formatCurrencyValue(next.priceCents, next.currency ?? previous.currency);

  return {
    previousValue:
      previousPrice ||
      getFirstText(previous.name, previous.description) ||
      formatBooleanValue(previous.isActive),
    newValue:
      nextPrice || getFirstText(next.name, next.description) || formatBooleanValue(next.isActive),
    rateName: getFirstText(next.name, previous.name) || "Tarifa não identificada",
    roomId: getFirstText(next.roomId, previous.roomId) || "Quarto não identificado",
  };
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

  const scopeWhere = buildRateAuditScopeWhere(scopedHotelIds);

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

  const rateAuditScopeWhere = {
    ...scopeWhere,
    action: {
      in: [...HOTEL_RATE_AUDIT_ACTIONS],
    },
  };
  const where = buildRateAuditWhere({
    endDate,
    filters,
    hasInvalidHotelFilter,
    scopedHotelIds,
    selectedHotelId,
    startDate,
  });

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
      where: rateAuditScopeWhere,
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
      where: rateAuditScopeWhere,
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
        <h1>Auditoria</h1>
        <p className="admin-rooms-copy">Consulte alterações feitas nas tarifas dos hotéis.</p>
      </div>

      <div className="admin-overview-grid">
        <article className="hotel-content-card admin-overview-card">
          <span>Registros</span>
          <strong>{totalLogs}</strong>
          <p>Eventos de tarifa visíveis para o seu usuário.</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Escopo</span>
          <strong>{user.globalRole === "super_admin" ? "Rede" : "Hotéis vinculados"}</strong>
          <p>
            {user.globalRole === "super_admin"
              ? "Exibindo logs de tarifas de todos os hotéis."
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
              placeholder="Tarifa, usuário, hotel ou IP"
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
          <strong>Nenhuma alteração de tarifa registrada.</strong>
          <p>Quando houver alterações de tarifas no seu escopo, elas aparecerão aqui.</p>
        </div>
      ) : (
        <div className="admin-history-list admin-audit-list">
          {logs.map((log) => {
            const changedFields = getChangedFields(log.changedFields);
            const auditSummary = getRateAuditSummary(log.previousValue, log.newValue);

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
                    <span>Quarto</span>
                    <strong>{auditSummary.roomId}</strong>
                  </p>
                  <p>
                    <span>Tarifa</span>
                    <strong>{auditSummary.rateName}</strong>
                  </p>
                  <p>
                    <span>Valor anterior</span>
                    <strong>{auditSummary.previousValue || "Não informado"}</strong>
                  </p>
                  <p>
                    <span>Novo valor</span>
                    <strong>{auditSummary.newValue || "Não informado"}</strong>
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
