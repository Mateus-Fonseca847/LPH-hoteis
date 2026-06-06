import { notFound } from "next/navigation";

import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { AuthorizationError, requireHotelEditAccess } from "@/lib/auth/authorization";
import { resolveHotelMapLocation } from "@/lib/hotel-location";
import { prisma } from "@/lib/prisma";
import { isValidHotelContactEmail } from "@/lib/validations/hotel";

import { HotelManagementWorkspace } from "../HotelManagementWorkspace";
import { HotelEditorForm } from "./HotelEditorForm";
import { HotelApprovalReview } from "./HotelApprovalReview";
import { HotelAvailabilitySection } from "./HotelAvailabilitySection";
import { HotelRatesSection } from "./HotelRatesSection";
import { HotelRoomsSection } from "./HotelRoomsSection";
import { submitHotelForApprovalAction, updateHotelProfileAction } from "./actions";

type AdminHotelDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatAuditAction(action: string) {
  if (action === "hotel.profile.updated") {
    return "Perfil atualizado";
  }

  if (action === "hotel.room_image.uploaded") {
    return "Imagem de quarto enviada";
  }

  if (action === "hotel.approval.submitted") {
    return "Enviado para aprovação";
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
      experiences: {
        orderBy: [{ createdAt: "asc" }, { title: "asc" }],
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
    },
  });

  if (!hotel) {
    notFound();
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const activeRoomsCount = hotel.rooms.filter((room) => room.isActive).length;
  const activeExperiencesCount = hotel.experiences.filter(
    (experience) => experience.isActive
  ).length;
  const [activeRatesCount, futureAvailabilityCount, approvalSubmissionsCount] =
    await prisma.$transaction([
      prisma.roomRate.count({
        where: {
          isActive: true,
          room: {
            hotelId: hotel.id,
            isActive: true,
          },
        },
      }),
      prisma.roomAvailability.count({
        where: {
          date: {
            gte: today,
          },
          closed: false,
          availableUnits: {
            gt: 0,
          },
          room: {
            hotelId: hotel.id,
            isActive: true,
          },
        },
      }),
      prisma.hotelAuditLog.count({
        where: {
          hotelId: hotel.id,
          action: "hotel.approval.submitted",
        },
      }),
    ]);

  const pendingApprovalItems = [
    hotel.name.trim() ? null : "nome",
    hotel.shortDescription.trim() ? null : "descrição curta",
    hotel.fullDescription.trim() ? null : "descrição completa",
    hotel.address.trim() ? null : "endereço",
    hotel.phone.trim() ? null : "telefone",
    isValidHotelContactEmail(hotel.email) ? null : "e-mail de contato valido",
    hotel.whatsapp.trim() ? null : "WhatsApp",
    hotel.coverImageUrl.trim() ? null : "imagem de capa",
    hotel.images.length > 0 ? null : "galeria",
    hotel.amenities.length > 0 ? null : "comodidades",
    hotel.policies.length > 0 ? null : "politicas",
    hotel.checkInTime.trim() ? null : "check-in",
    hotel.checkOutTime.trim() ? null : "check-out",
    resolveHotelMapLocation({
      city: hotel.city,
      state: hotel.state,
      latitude: hotel.latitude,
      longitude: hotel.longitude,
    })
      ? null
      : "localização no mapa",
    activeRoomsCount > 0 ? null : "quarto",
    activeRatesCount > 0 ? null : "tarifa",
    futureAvailabilityCount > 0 ? null : "disponibilidade futura",
  ].filter((item): item is string => Boolean(item));

  const submittedForApproval = approvalSubmissionsCount > 0;
  const approvalSteps = [
    {
      label: "Dados do hotel",
      description: hotel.coverImageUrl && hotel.images.length > 0 ? "Completo" : "Em edição",
      href: "#hotel-profile",
      status: pendingApprovalItems.some((item) =>
        [
          "nome",
          "descrição curta",
          "descrição completa",
          "endereço",
          "telefone",
          "e-mail de contato valido",
          "WhatsApp",
          "imagem de capa",
          "galeria",
          "comodidades",
          "politicas",
          "check-in",
          "check-out",
        ].includes(item)
      )
        ? ("current" as const)
        : ("complete" as const),
    },
    {
      label: "Quartos",
      description: `${activeRoomsCount} cadastrado(s)`,
      href: "#hotel-rooms",
      status: activeRoomsCount > 0 ? ("complete" as const) : ("pending" as const),
    },
    {
      label: "Tarifas",
      description: `${activeRatesCount} ativa(s)`,
      href: "#hotel-rates",
      status: activeRatesCount > 0 ? ("complete" as const) : ("pending" as const),
    },
    {
      label: "Disponibilidade",
      description: `${futureAvailabilityCount} período(s)`,
      href: "#hotel-availability",
      status: futureAvailabilityCount > 0 ? ("complete" as const) : ("pending" as const),
    },
    {
      label: "Revisão",
      description: pendingApprovalItems.length === 0 ? "Pronto para envio" : "Pendente",
      href: "#hotel-review",
      status: pendingApprovalItems.length === 0 ? ("complete" as const) : ("pending" as const),
    },
  ];

  const saveAction = updateHotelProfileAction.bind(null, hotel.id);
  const approvalAction = submitHotelForApprovalAction.bind(null, hotel.id);

  return (
    <HotelManagementWorkspace
      backHref="/admin/hoteis"
      backLabel="Voltar para hotéis"
      title={hotel.name}
      topSlot={
        <HotelApprovalReview
          action={approvalAction}
          summary={{
            hotelName: hotel.name,
            coverImageUrl: hotel.coverImageUrl,
            statusLabel: hotel.isPublished
              ? "Publicado"
              : submittedForApproval
                ? "Enviado para aprovação"
                : "Rascunho",
            roomsCount: activeRoomsCount,
            ratesCount: activeRatesCount,
            availabilityPeriodsCount: futureAvailabilityCount,
            experiencesCount: hotel.experiences.length,
            activeExperiencesCount,
            experiences: hotel.experiences.map((experience) => ({
              id: experience.id,
              title: experience.title,
              city: experience.city,
              state: experience.state,
              categories: experience.categories,
              isActive: experience.isActive,
            })),
            pending: pendingApprovalItems,
            submittedForApproval,
            hasMapLocation: Boolean(
              resolveHotelMapLocation({
                city: hotel.city,
                state: hotel.state,
                latitude: hotel.latitude,
                longitude: hotel.longitude,
              })
            ),
            steps: approvalSteps,
          }}
        />
      }
      formSlot={
        <div id="hotel-profile">
          <HotelEditorForm
            action={saveAction}
            hotel={{
              ...hotel,
              latitude: hotel.latitude?.toString() ?? null,
              longitude: hotel.longitude?.toString() ?? null,
              experiences: hotel.experiences,
            }}
            canEditMapLocation={user.globalRole === "super_admin"}
            hasResolvedMapLocation={Boolean(
              resolveHotelMapLocation({
                city: hotel.city,
                state: hotel.state,
                latitude: hotel.latitude,
                longitude: hotel.longitude,
              })
            )}
          />
        </div>
      }
      roomsSlot={
        <div id="hotel-rooms">
          <HotelRoomsSection
            hotelId={hotel.id}
            initialRooms={hotel.rooms.map((room) => ({
              ...room,
              priceFrom: room.priceFrom.toString(),
            }))}
          />
        </div>
      }
      ratesSlot={
        <div id="hotel-rates">
          <HotelRatesSection
            hotelId={hotel.id}
            rooms={hotel.rooms.map((room) => ({
              id: room.id,
              name: room.name,
            }))}
          />
        </div>
      }
      availabilitySlot={
        <div id="hotel-availability">
          <HotelAvailabilitySection
            hotelId={hotel.id}
            rooms={hotel.rooms.map((room) => ({
              id: room.id,
              name: room.name,
            }))}
          />
        </div>
      }
      footerSlot={
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
      }
    />
  );
}
