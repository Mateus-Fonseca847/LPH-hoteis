import { HotelRole } from "@prisma/client";
import Link from "next/link";

import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import { AdminAccessDenied } from "../AdminAccessDenied";

type AdminHotelListItem = {
  id: string;
  name: string;
  city: string;
  state: string;
  coverImageUrl: string;
  isPublished: boolean;
  permissionRole: string | null;
};

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

  if (user.globalRole === "super_admin") {
    hotels = await prisma.hotel.findMany({
      select: {
        id: true,
        name: true,
        city: true,
        state: true,
        coverImageUrl: true,
        isPublished: true,
      },
      orderBy: [{ city: "asc" }, { name: "asc" }],
    }).then((items) =>
      items.map((hotel) => ({
        ...hotel,
        permissionRole: null,
      }))
    );
  } else {
    hotels = await prisma.hotelPermission.findMany({
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
            name: true,
            city: true,
            state: true,
            coverImageUrl: true,
            isPublished: true,
          },
        },
      },
      orderBy: {
        hotel: {
          name: "asc",
        },
      },
    }).then((items) =>
      items.map(({ role, hotel }) => ({
        ...hotel,
        permissionRole: role,
      }))
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
              <img
                className="admin-hotel-card-image"
                src={hotel.coverImageUrl}
                alt={`Imagem de capa do ${hotel.name}`}
              />

              <div className="admin-hotel-card-top">
                <span>
                  {hotel.city}, {hotel.state}
                </span>
                <strong>{hotel.name}</strong>
              </div>

              <div className="admin-hotel-card-meta">
                <p>Status: {hotel.isPublished ? "Publicado" : "Rascunho"}</p>
                <p>Permissão: {hotel.permissionRole ?? "total"}</p>
              </div>

              <Link href={`/admin/hoteis/${hotel.id}`} className="card-cta-button admin-edit-button">
                Editar
              </Link>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
