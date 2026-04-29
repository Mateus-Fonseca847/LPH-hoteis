import { HotelRole } from "@prisma/client";
import Image from "next/image";
import Link from "next/link";

import {
  calculateHotelCompleteness,
  getHotelCompletenessSelect,
} from "@/lib/admin/hotel-completeness";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AdminAccessDenied } from "../AdminAccessDenied";

type AdminHotelListItem = {
  city: string;
  completenessPending: string[];
  completenessPercentage: number;
  coverImageUrl: string;
  id: string;
  isPublished: boolean;
  name: string;
  permissionRole: string | null;
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

  if (user.globalRole === "super_admin") {
    hotels = await prisma.hotel
      .findMany({
        select: {
          id: true,
          city: true,
          state: true,
          isPublished: true,
          ...completenessSelect,
        },
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
          };
        })
      );
  } else {
    hotels = await prisma.hotelPermission
      .findMany({
        where: {
          userId: user.id,
          role: {
            in: [HotelRole.owner, HotelRole.admin, HotelRole.editor],
          },
        },
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
          };
        })
      );
  }

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Admin</span>
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
              <Image
                className="admin-hotel-card-image"
                src={hotel.coverImageUrl}
                alt={`Imagem de capa do ${hotel.name}`}
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

              <Link
                href={`/admin/hoteis/${hotel.id}`}
                className="card-cta-button admin-edit-button"
              >
                Editar
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
