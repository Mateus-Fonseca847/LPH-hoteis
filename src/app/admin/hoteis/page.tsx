import { HotelRole, Prisma } from "@prisma/client";
import Link from "next/link";

import { ImageWithFallback } from "@/components/ImageWithFallback";
import {
  calculateHotelCompleteness,
  getHotelCompletenessSelect,
} from "@/lib/admin/hotel-completeness";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { getActiveHotelWhere, hasHotelArchiveFields } from "@/lib/hotel-archive";
import { prisma } from "@/lib/prisma";

import { AdminAccessDenied } from "../AdminAccessDenied";
import { removeHotelAction } from "./actions";
import { RemoveHotelButton } from "./RemoveHotelButton";

type AdminHotelListItem = {
  city: string;
  completenessPending: string[];
  completenessPercentage: number;
  coverImageUrl: string;
  id: string;
  isPublished: boolean;
  name: string;
  permissionRole: string | null;
  canRemove: boolean;
  state: string;
};

function formatPermissionRole(role: string | null) {
  if (!role) {
    return "Acesso total";
  }

  const labels: Record<string, string> = {
    owner: "Responsável",
    admin: "Administrador",
    editor: "Editor",
  };

  return labels[role] ?? role;
}

function getSafeListError(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      meta: error.meta,
      isMissingFieldOrMigration: error.code === "P2022" || error.code === "P2021",
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return {
    name: "UnknownError",
    message: String(error),
  };
}

export default async function AdminHotelsPage() {
  let user;

  try {
    user = await requireAdminRouteSession("/admin/hoteis");
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  let hotels: AdminHotelListItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const completenessSelect = getHotelCompletenessSelect(today);
  const supportsArchiveFilter = await hasHotelArchiveFields();
  const activeHotelWhere = await getActiveHotelWhere();

  console.info("[admin/hoteis/list] Loading hotels.", {
    userId: user.id,
    globalRole: user.globalRole,
    step: "start",
    filters: {
      supportsArchiveFilter,
      activeHotelWhere,
    },
  });

  try {
    if (user.globalRole === "super_admin") {
      console.info("[admin/hoteis/list] Querying super_admin hotels.", {
        userId: user.id,
        globalRole: user.globalRole,
        step: "super_admin-query",
        filters: activeHotelWhere,
      });

      hotels = await prisma.hotel
        .findMany({
          select: {
            id: true,
            city: true,
            state: true,
            isPublished: true,
            ...completenessSelect,
          },
          where: activeHotelWhere,
          orderBy: [{ city: "asc" }, { name: "asc" }],
        })
        .then((items) =>
          items.map((hotel) => {
            const completeness = calculateHotelCompleteness(hotel);

            return {
              ...hotel,
              completenessPending: completeness.pending,
              completenessPercentage: completeness.percentage,
              permissionRole: null,
              canRemove: true,
            };
          })
        );
    } else {
      const hotelPermissionWhere = {
        userId: user.id,
        role: {
          in: [HotelRole.owner, HotelRole.admin, HotelRole.editor],
        },
        ...(supportsArchiveFilter ? { hotel: activeHotelWhere } : {}),
      };

      console.info("[admin/hoteis/list] Querying scoped hotel_admin hotels.", {
        userId: user.id,
        globalRole: user.globalRole,
        step: "hotel_admin-query",
        filters: hotelPermissionWhere,
      });

      hotels = await prisma.hotelPermission
        .findMany({
          where: hotelPermissionWhere,
          select: {
            role: true,
            hotel: {
              select: {
                id: true,
                city: true,
                state: true,
                isPublished: true,
                ...completenessSelect,
              },
            },
          },
          orderBy: {
            hotel: {
              name: "asc",
            },
          },
        })
        .then((items) =>
          items.map(({ role, hotel }) => {
            const completeness = calculateHotelCompleteness(hotel);

            return {
              ...hotel,
              completenessPending: completeness.pending,
              completenessPercentage: completeness.percentage,
              permissionRole: role,
              canRemove: role === HotelRole.owner || role === HotelRole.admin,
            };
          })
        );
    }

    console.info("[admin/hoteis/list] Hotels loaded.", {
      userId: user.id,
      globalRole: user.globalRole,
      step: "done",
      count: hotels.length,
    });
  } catch (error) {
    console.error("[admin/hoteis/list] Failed to load hotels.", {
      userId: user.id,
      globalRole: user.globalRole,
      step: user.globalRole === "super_admin" ? "super_admin-query" : "hotel_admin-query",
      filters: user.globalRole === "super_admin" ? activeHotelWhere : { supportsArchiveFilter },
      error: getSafeListError(error),
    });

    throw error;
  }

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <h1>Hotéis</h1>
      </div>

      {hotels.length === 0 ? (
        <div className="hotel-empty-state">
          <strong>Nenhum hotel disponível para sua conta.</strong>
          <p>Quando uma permissão for vinculada, os hotéis aparecerão aqui.</p>
        </div>
      ) : (
        <div className="admin-hotels-grid">
          {hotels.map((hotel) => (
            <article key={hotel.id} className="hotel-content-card admin-hotel-card">
              <ImageWithFallback
                className="admin-hotel-card-image"
                src={hotel.coverImageUrl}
                alt={`Imagem de capa do ${hotel.name}`}
                fallbackLabel={`Imagem indisponível de ${hotel.name}`}
                width={520}
                height={320}
                sizes="(max-width: 900px) 100vw, 33vw"
                unoptimized
              />

              <div className="admin-hotel-card-top">
                <span>
                  {hotel.city}, {hotel.state}
                </span>
                <strong>{hotel.name}</strong>
              </div>

              <div className="admin-hotel-card-meta">
                <p>Status: {hotel.isPublished ? "Publicado" : "Rascunho"}</p>
                <p>Permissão: {formatPermissionRole(hotel.permissionRole)}</p>
                <p>Completude: {hotel.completenessPercentage}%</p>
                {hotel.completenessPending.length > 0 ? (
                  <p>Pendências: {hotel.completenessPending.slice(0, 3).join(", ")}</p>
                ) : (
                  <p>Perfil completo para operação.</p>
                )}
              </div>

              <div className="admin-hotel-card-actions">
                <Link
                  href={`/admin/hoteis/${hotel.id}`}
                  className="card-cta-button admin-edit-button"
                >
                  Editar
                </Link>

                {hotel.canRemove ? (
                  <RemoveHotelButton
                    action={removeHotelAction.bind(null, hotel.id)}
                    hotelName={hotel.name}
                  />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
