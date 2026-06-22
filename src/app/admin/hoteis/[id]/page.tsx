import { Prisma } from "@prisma/client";
import Link from "next/link";

import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { AuthorizationError, requireHotelEditAccess } from "@/lib/auth/authorization";
import { hasHotelArchiveFields } from "@/lib/hotel-archive";
import { resolveHotelMapLocation } from "@/lib/hotel-location";
import { prisma } from "@/lib/prisma";
import { isValidHotelContactEmail } from "@/lib/validations/hotel";

import { HotelManagementWorkspace } from "../HotelManagementWorkspace";
import { HotelEditorForm } from "./HotelEditorForm";
import { HotelApprovalReview } from "./HotelApprovalReview";
import { HotelAvailabilitySection } from "./HotelAvailabilitySection";
import { HotelRoomsSection } from "./HotelRoomsSection";
import {
  approveHotelAction,
  submitHotelForApprovalAction,
  updateHotelProfileAction,
} from "./actions";

type AdminHotelDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function getSafeEditLoadError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      meta: error.meta,
      isMissingFieldOrMigration: error.code === "P2021" || error.code === "P2022",
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      isRelationOrIncompleteDataError:
        error.message.includes("RoomRate") ||
        error.message.includes("RoomAvailability") ||
        error.message.includes("HotelExperience") ||
        error.message.includes("relation"),
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

function getEditLoadErrorMessage(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2021" || error.code === "P2022") {
      return "Erro de schema do banco. Aplique as migrations.";
    }
  }

  if (error instanceof Error) {
    if (
      error.message.includes("RoomRate") ||
      error.message.includes("RoomAvailability") ||
      error.message.includes("HotelExperience") ||
      error.message.includes("relation")
    ) {
      return "Não foi possível carregar todos os dados deste hotel. Verifique quartos, tarifas, disponibilidade ou experiências.";
    }
  }

  return "Não foi possível carregar este hotel.";
}

function AdminHotelEditLoadError({ title, description }: { title: string; description: string }) {
  return (
    <section className="section admin-section">
      <div className="hotel-empty-state" role="alert">
        <strong>{title}</strong>
        <p>{description}</p>
        <div className="hotel-error-actions">
          <Link href="/admin/hoteis" className="card-cta-button">
            Voltar para hotéis
          </Link>
          <Link href="/admin" className="admin-secondary-button">
            Voltar para o painel
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function AdminHotelDetailPage({ params }: AdminHotelDetailPageProps) {
  const { id } = await params;
  let user;

  console.info("[admin/hoteis/edit/load] Starting hotel edit load.", {
    hotelId: id,
    step: "start",
  });

  try {
    user = await requireAdminRouteSession(`/admin/hoteis/${id}`);
  } catch (error) {
    if (error instanceof AdminAccessError) {
      console.warn("[admin/hoteis/edit/load] Admin route session denied.", {
        hotelId: id,
        step: "auth",
        error: getSafeEditLoadError(error),
      });

      return <AdminAccessDenied />;
    }

    throw error;
  }

  console.info("[admin/hoteis/edit/load] User authenticated.", {
    hotelId: id,
    userId: user.id,
    globalRole: user.globalRole,
    step: "auth",
  });

  if (user.globalRole !== "super_admin") {
    try {
      const permission = await requireHotelEditAccess(user.id, id);
      console.info("[admin/hoteis/edit/load] Hotel edit authorization granted.", {
        hotelId: id,
        userId: user.id,
        globalRole: user.globalRole,
        step: "authorization",
        hasHotelPermission: Boolean(permission.hotelRole),
        hotelRole: permission.hotelRole,
      });
    } catch (error) {
      if (error instanceof AuthorizationError) {
        console.warn("[admin/hoteis/edit/load] Hotel edit authorization denied.", {
          hotelId: id,
          userId: user.id,
          globalRole: user.globalRole,
          step: "authorization",
          hasHotelPermission: false,
          error: getSafeEditLoadError(error),
        });

        return (
          <AdminHotelEditLoadError
            title="Você não tem permissão para editar este hotel."
            description="Sua sessão está válida, mas este hotel não está vinculado ao seu escopo de edição."
          />
        );
      }

      throw error;
    }
  } else {
    console.info("[admin/hoteis/edit/load] Super admin authorization granted.", {
      hotelId: id,
      userId: user.id,
      globalRole: user.globalRole,
      step: "authorization",
      hasHotelPermission: "not_required",
    });
  }

  const supportsArchiveFields = await hasHotelArchiveFields();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  let hotel;
  let activeRatesCount = 0;
  let futureAvailabilityCount = 0;
  let approvalSubmissionsCount = 0;

  try {
    console.info("[admin/hoteis/edit/load] Querying hotel.", {
      hotelId: id,
      userId: user.id,
      globalRole: user.globalRole,
      step: "hotel-query",
      filters: {
        id,
        supportsArchiveFields,
      },
    });

    hotel = await prisma.hotel.findUnique({
      where: {
        id,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        shortDescription: true,
        fullDescription: true,
        city: true,
        state: true,
        address: true,
        latitude: true,
        longitude: true,
        phone: true,
        email: true,
        whatsapp: true,
        coverImageUrl: true,
        checkInTime: true,
        checkOutTime: true,
        isPublished: true,
        ...(supportsArchiveFields ? { isArchived: true } : {}),
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
            images: {
              orderBy: {
                position: "asc",
              },
              select: {
                id: true,
                url: true,
                alt: true,
                position: true,
              },
            },
            units: true,
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
      },
    });

    console.info("[admin/hoteis/edit/load] Hotel query completed.", {
      hotelId: id,
      userId: user.id,
      globalRole: user.globalRole,
      step: "hotel-query",
      hotelFound: Boolean(hotel),
    });

    if (!hotel) {
      return (
        <AdminHotelEditLoadError
          title="Hotel não encontrado."
          description="Não encontramos um hotel com o identificador informado."
        />
      );
    }

    if (supportsArchiveFields && "isArchived" in hotel && hotel.isArchived) {
      return (
        <AdminHotelEditLoadError
          title="Este hotel foi removido ou arquivado."
          description="Hotéis removidos não ficam disponíveis para edição operacional."
        />
      );
    }

    console.info("[admin/hoteis/edit/load] Querying related counters.", {
      hotelId: hotel.id,
      userId: user.id,
      globalRole: user.globalRole,
      step: "related-counters",
    });

    [activeRatesCount, futureAvailabilityCount, approvalSubmissionsCount] =
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

    console.info("[admin/hoteis/edit/load] Hotel edit data loaded.", {
      hotelId: hotel.id,
      userId: user.id,
      globalRole: user.globalRole,
      step: "done",
      hotelFound: true,
    });
  } catch (error) {
    const message = getEditLoadErrorMessage(error);

    console.error("[admin/hoteis/edit/load] Failed to load hotel edit data.", {
      hotelId: id,
      userId: user.id,
      globalRole: user.globalRole,
      step: "load-error",
      filters: {
        id,
        supportsArchiveFields,
      },
      error: getSafeEditLoadError(error),
    });

    return (
      <AdminHotelEditLoadError
        title={message}
        description="A equipe administrativa pode usar os logs do servidor para identificar a etapa exata da falha."
      />
    );
  }

  const activeRoomsCount = hotel.rooms.filter((room) => room.isActive).length;
  const activeExperiencesCount = hotel.experiences.filter(
    (experience) => experience.isActive
  ).length;
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
      href: "#hotel-rooms",
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
  const publishAction =
    user.globalRole === "super_admin" ? approveHotelAction.bind(null, hotel.id) : undefined;

  return (
    <HotelManagementWorkspace
      backHref="/admin/hoteis"
      backLabel="Voltar para hotéis"
      title={hotel.name}
      topSlot={
        <HotelApprovalReview
          action={approvalAction}
          publishAction={publishAction}
          canPublish={user.globalRole === "super_admin"}
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
            isPublished: hotel.isPublished,
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
      availabilitySlot={
        <div id="hotel-availability">
          <HotelAvailabilitySection
            hotelId={hotel.id}
            rooms={hotel.rooms.map((room) => ({
              id: room.id,
              name: room.name,
              units: room.units,
              capacityAdults: room.capacityAdults,
              capacityChildren: room.capacityChildren,
              capacity: room.capacity,
              isActive: room.isActive,
            }))}
          />
        </div>
      }
    />
  );
}
