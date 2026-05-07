import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import {
  AuthorizationError,
  requireHotelAdminAccess,
  requireHotelEditAccess,
} from "@/lib/auth/authorization";
import { prisma } from "@/lib/prisma";

import { HotelEditorForm } from "./HotelEditorForm";
import { HotelAvailabilitySection } from "./HotelAvailabilitySection";
import { HotelPaymentSettingsForm } from "./HotelPaymentSettingsForm";
import { HotelRatesSection } from "./HotelRatesSection";
import { HotelRoomsSection } from "./HotelRoomsSection";
import { updateHotelProfileAction } from "./actions";
import { updateHotelPaymentSettingsAction } from "./payment-actions";

type AdminHotelDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatAuditAction(action: string) {
  if (action === "hotel.profile.updated") {
    return "Perfil atualizado";
  }

  if (action === "hotel.payment_settings.updated") {
    return "Pagamentos atualizados";
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

  if (user.globalRole !== "super_admin") {
    try {
      await requireHotelEditAccess(user.id, id);
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
      rooms: {
        orderBy: [{ createdAt: "asc" }, { name: "asc" }],
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          capacityAdults: true,
          capacityChildren: true,
          beds: true,
          sizeM2: true,
          amenities: true,
          isActive: true,
          capacity: true,
          size: true,
          priceFrom: true,
          isAvailable: true,
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
      paymentSettings: true,
    },
  });

  if (!hotel) {
    notFound();
  }

  const canManagePaymentSettings =
    user.globalRole === "super_admin" ||
    (await requireHotelAdminAccess(user.id, hotel.id)
      .then(() => true)
      .catch((error) => {
        if (error instanceof AuthorizationError) {
          return false;
        }

        throw error;
      }));

  const saveAction = updateHotelProfileAction.bind(null, hotel.id);
  const savePaymentSettingsAction = updateHotelPaymentSettingsAction.bind(null, hotel.id);
  const paymentSettings = hotel.paymentSettings
    ? {
        provider: hotel.paymentSettings.provider,
        isEnabled: hotel.paymentSettings.isEnabled,
        receiverLabel: hotel.paymentSettings.receiverLabel,
        publicKey: hotel.paymentSettings.publicKey,
        hasAccessToken: Boolean(hotel.paymentSettings.encryptedAccessToken),
        pixKey: hotel.paymentSettings.pixKey,
        payoutDocument: hotel.paymentSettings.payoutDocument,
      }
    : {
        provider: "manual" as const,
        isEnabled: false,
        receiverLabel: `${hotel.name} - teste`,
        publicKey: null,
        hasAccessToken: false,
        pixKey: null,
        payoutDocument: null,
      };

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Editor</span>
        <h1>{hotel.name}</h1>
      </div>

      <HotelEditorForm action={saveAction} hotel={hotel} />
      {canManagePaymentSettings ? (
        <HotelPaymentSettingsForm
          action={savePaymentSettingsAction}
          settings={paymentSettings}
          isConfigured={Boolean(hotel.paymentSettings)}
        />
      ) : (
        <section className="hotel-content-card admin-form-section">
          <div className="section-heading admin-subsection-heading">
            <h2>Pagamentos</h2>
          </div>
          <div className="admin-editor-banner">
            <strong>Acesso restrito</strong>
            <p>Apenas administradores do hotel podem alterar configurações financeiras.</p>
          </div>
        </section>
      )}
      <HotelRoomsSection
        hotelId={hotel.id}
        initialRooms={hotel.rooms.map((room) => ({
          ...room,
          priceFrom: room.priceFrom.toString(),
        }))}
      />
      <HotelRatesSection
        hotelId={hotel.id}
        rooms={hotel.rooms.map((room) => ({
          id: room.id,
          name: room.name,
        }))}
      />
      <HotelAvailabilitySection
        hotelId={hotel.id}
        rooms={hotel.rooms.map((room) => ({
          id: room.id,
          name: room.name,
        }))}
      />

      <section className="hotel-content-card admin-history-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Histórico de alterações</h2>
        </div>

        {hotel.auditLogs.length === 0 ? (
          <div className="hotel-empty-state admin-history-empty">
            <strong>Nenhuma alteração registrada.</strong>
            <p>
              Quando este hotel receber atualizações administrativas, o histórico aparecerá aqui.
            </p>
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
