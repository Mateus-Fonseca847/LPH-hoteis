import { notFound } from "next/navigation";

import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { IconBackLink } from "@/components/IconBackLink";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { HOTEL_RATE_AUDIT_ACTIONS } from "@/lib/audit/rate-audit-actions";
import { prisma } from "@/lib/prisma";

type AdminAuditDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const sensitiveKeyPattern = /password|senha|token|secret|segredo|twoFactor|2fa|hash/i;

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

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [
        key,
        sensitiveKeyPattern.test(key) ? "[redigido]" : sanitizeAuditValue(item),
      ])
    );
  }

  return value;
}

function formatJsonValue(value: unknown) {
  if (value === null || value === undefined) {
    return "Não informado";
  }

  return JSON.stringify(sanitizeAuditValue(value), null, 2);
}

export default async function AdminAuditDetailPage({ params }: AdminAuditDetailPageProps) {
  const { id } = await params;
  let user;

  try {
    user = await requireAdminRouteSession(`/admin/auditoria/${id}`);
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  if (user.globalRole !== "super_admin") {
    return <AdminAccessDenied />;
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

  const log = await prisma.hotelAuditLog.findFirst({
    where: {
      id,
      action: {
        in: [...HOTEL_RATE_AUDIT_ACTIONS],
      },
      ...(scopedHotelIds === null
        ? {}
        : {
            hotelId: {
              in: scopedHotelIds,
            },
          }),
    },
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
  });

  if (!log) {
    notFound();
  }

  const changedFields = getChangedFields(log.changedFields);

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <h1>{formatAuditAction(log.action)}</h1>
        <p className="admin-rooms-copy">Detalhe seguro da alteração de tarifa selecionada.</p>
      </div>

      <div className="admin-overview-grid">
        <article className="hotel-content-card admin-overview-card">
          <span>Usuário</span>
          <strong>{log.user.name || log.user.email}</strong>
          <p>{log.user.email}</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Hotel</span>
          <strong>{log.hotel.name}</strong>
          <p>Tarifa</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Data e IP</span>
          <strong>{formatAuditDate(log.createdAt)}</strong>
          <p>{log.ipAddress || "IP não informado"}</p>
        </article>
      </div>

      <section className="hotel-content-card admin-audit-detail-card">
        <div className="admin-audit-meta">
          <p>
            <span>Ação</span>
            <strong>{log.action}</strong>
          </p>
          <p>
            <span>Entidade</span>
            <strong>Tarifa</strong>
          </p>
          <p>
            <span>Campos</span>
            <strong>{changedFields.length}</strong>
          </p>
        </div>

        <div className="admin-history-fields">
          {changedFields.length > 0 ? (
            changedFields.map((field) => (
              <span key={field} className="admin-history-tag">
                {field}
              </span>
            ))
          ) : (
            <span className="admin-history-tag">Sem campos detalhados</span>
          )}
        </div>

        <div className="admin-audit-values-grid">
          <article>
            <span>Valor anterior</span>
            <pre>{formatJsonValue(log.previousValue)}</pre>
          </article>
          <article>
            <span>Novo valor</span>
            <pre>{formatJsonValue(log.newValue)}</pre>
          </article>
        </div>
      </section>

      <IconBackLink href="/admin/auditoria" ariaLabel="Voltar para auditoria" />
    </section>
  );
}
