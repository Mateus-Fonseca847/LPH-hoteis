import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { AuthorizationError, requireHotelEditAccess } from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

import { HotelEditorForm } from "./HotelEditorForm";
import { updateHotelProfileAction } from "./actions";

type AdminHotelDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatAuditAction(action: string) {
  if (action === "hotel.profile.updated") {
    return "Perfil atualizado";
  }

  return action;
}

function formatAuditDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

export default async function AdminHotelDetailPage({ params }: AdminHotelDetailPageProps) {
  const { id } = await params;
  let user;

  try {
    user = await requireAdminRouteSession(`/admin/hoteis/${id}`);
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  const hotel = await prisma.hotel.findUnique({
    where: {
      id,
    },
    include: {
      amenities: {
        orderBy: {
          position: "asc",
        },
      },
      policies: {
        orderBy: {
          position: "asc",
        },
      },
      images: {
        orderBy: {
          position: "asc",
        },
      },
      auditLogs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 12,
        include: {
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!hotel) {
    notFound();
  }

  try {
    await requireHotelEditAccess(user.id, hotel.id);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return (
        <AdminAccessDenied
          title="Hotel indisponível para edição"
          description="Sua sessão está válida, mas este hotel não está vinculado ao seu escopo de edição."
        />
      );
    }

    throw error;
  }

  const saveAction = updateHotelProfileAction.bind(null, hotel.id);

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Editor</span>
        <h1>{hotel.name}</h1>
      </div>

      <HotelEditorForm action={saveAction} hotel={hotel} />

      <section className="hotel-content-card admin-history-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Histórico de alterações</h2>
        </div>

        {hotel.auditLogs.length === 0 ? (
          <div className="hotel-empty-state admin-history-empty">
            <strong>Nenhuma alteração registrada.</strong>
            <p>Quando este hotel receber atualizações administrativas, o histórico aparecerá aqui.</p>
          </div>
        ) : (
          <div className="admin-history-list">
            {hotel.auditLogs.map((log) => {
              const changedFields = Array.isArray(log.changedFields) ? log.changedFields : [];

              return (
                <article key={log.id} className="admin-history-item">
                  <div className="admin-history-item-top">
                    <div>
                      <strong>{formatAuditAction(log.action)}</strong>
                      <p>{log.user.name || log.user.email}</p>
                    </div>
                    <span>{formatAuditDate(log.createdAt)}</span>
                  </div>

                  <div className="admin-history-fields">
                    {changedFields.length > 0 ? (
                      changedFields.map((field) => (
                        <span key={`${log.id}-${String(field)}`} className="admin-history-tag">
                          {String(field)}
                        </span>
                      ))
                    ) : (
                      <span className="admin-history-tag">Sem campos detalhados</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <Link href="/admin/hoteis" className="hotel-page-back">
        Voltar para hotéis
      </Link>
    </section>
  );
}
