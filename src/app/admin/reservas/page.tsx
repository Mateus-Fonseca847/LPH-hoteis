import type { PaymentProvider, PaymentStatus, Prisma, ReservationStatus } from "@prisma/client";
import Link from "next/link";

import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AdminReservationsPageProps = {
  searchParams: Promise<{
    checkInEnd?: string;
    checkInStart?: string;
    hotelId?: string;
    page?: string;
    paymentStatus?: string;
    q?: string;
    status?: string;
  }>;
};

const pageSize = 25;

const reservationStatusOptions: Array<{ value: ReservationStatus; label: string }> = [
  { value: "pending", label: "Pendente" },
  { value: "awaiting_payment", label: "Aguardando pagamento" },
  { value: "confirmed", label: "Confirmada" },
  { value: "paid", label: "Paga" },
  { value: "payment_failed", label: "Pagamento falhou" },
  { value: "cancelled", label: "Cancelada" },
];

const paymentStatusOptions: Array<{ value: PaymentStatus; label: string }> = [
  { value: "pending", label: "Pendente" },
  { value: "awaiting_payment", label: "Aguardando pagamento" },
  { value: "paid", label: "Pago" },
  { value: "payment_failed", label: "Falhou" },
  { value: "cancelled", label: "Cancelado" },
];

const providerLabels: Record<PaymentProvider, string> = {
  manual: "Manual",
  mercado_pago: "Mercado Pago",
};

function parsePage(value: string | undefined) {
  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

function parseDateFilter(value: string | undefined, endOfDay = false) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);

  return Number.isNaN(date.getTime()) ? null : date;
}

function isReservationStatus(value: string): value is ReservationStatus {
  return reservationStatusOptions.some((option) => option.value === value);
}

function isPaymentStatus(value: string): value is PaymentStatus {
  return paymentStatusOptions.some((option) => option.value === value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(value);
}

function formatDateTime(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

function formatCurrency(cents: number, currency = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

function formatProvider(provider: PaymentProvider | null) {
  return provider ? providerLabels[provider] : "Nao informado";
}

function buildPageHref(
  page: number,
  filters: {
    checkInEnd: string;
    checkInStart: string;
    hotelId: string;
    paymentStatus: string;
    q: string;
    status: string;
  }
) {
  const params = new URLSearchParams();
  params.set("page", String(page));

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      params.set(key, value);
    }
  }

  return `/admin/reservas?${params.toString()}`;
}

export default async function AdminReservationsPage({ searchParams }: AdminReservationsPageProps) {
  const params = await searchParams;
  const currentPage = parsePage(params.page);
  const filters = {
    checkInEnd: params.checkInEnd?.trim() ?? "",
    checkInStart: params.checkInStart?.trim() ?? "",
    hotelId: params.hotelId?.trim() ?? "",
    paymentStatus: params.paymentStatus?.trim() ?? "",
    q: params.q?.trim() ?? "",
    status: params.status?.trim() ?? "",
  };
  let user;

  try {
    user = await requireAdminRouteSession("/admin/reservas");
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

  const hotelOptions = await prisma.hotel.findMany({
    where:
      scopedHotelIds === null
        ? {}
        : {
            id: {
              in: scopedHotelIds,
            },
          },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
    },
  });
  const allowedHotelIds = new Set(hotelOptions.map((hotel) => hotel.id));
  const hasInvalidHotelFilter = Boolean(filters.hotelId && !allowedHotelIds.has(filters.hotelId));
  const selectedHotelId = hasInvalidHotelFilter ? "" : filters.hotelId;
  const selectedReservationStatus = isReservationStatus(filters.status) ? filters.status : "";
  const selectedPaymentStatus = isPaymentStatus(filters.paymentStatus) ? filters.paymentStatus : "";
  const checkInStart = parseDateFilter(filters.checkInStart);
  const checkInEnd = parseDateFilter(filters.checkInEnd, true);

  const scopeWhere: Prisma.ReservationWhereInput =
    scopedHotelIds === null
      ? {}
      : {
          hotelId: {
            in: scopedHotelIds,
          },
        };

  const where: Prisma.ReservationWhereInput = {
    ...scopeWhere,
    ...(hasInvalidHotelFilter ? { hotelId: "__hotel_outside_scope__" } : {}),
    ...(selectedHotelId ? { hotelId: selectedHotelId } : {}),
    ...(selectedReservationStatus ? { status: selectedReservationStatus } : {}),
    ...(selectedPaymentStatus ? { paymentStatus: selectedPaymentStatus } : {}),
    ...(checkInStart || checkInEnd
      ? {
          checkIn: {
            ...(checkInStart ? { gte: checkInStart } : {}),
            ...(checkInEnd ? { lte: checkInEnd } : {}),
          },
        }
      : {}),
    ...(filters.q
      ? {
          OR: [
            { guestName: { contains: filters.q, mode: "insensitive" } },
            { guestEmail: { contains: filters.q, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [reservations, totalReservations, paidReservations, awaitingPaymentReservations] =
    await prisma.$transaction([
      prisma.reservation.findMany({
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
          room: {
            select: {
              name: true,
            },
          },
        },
      }),
      prisma.reservation.count({ where }),
      prisma.reservation.count({
        where: {
          ...scopeWhere,
          paymentStatus: "paid",
        },
      }),
      prisma.reservation.count({
        where: {
          ...scopeWhere,
          paymentStatus: {
            in: ["pending", "awaiting_payment"],
          },
        },
      }),
    ]);
  const totalPages = Math.max(1, Math.ceil(totalReservations / pageSize));

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Admin</span>
        <h1>Reservas</h1>
        <p className="admin-rooms-copy">
          Acompanhe reservas e pagamentos dentro do seu escopo, sem confirmacao manual insegura.
        </p>
      </div>

      <div className="admin-overview-grid">
        <article className="hotel-content-card admin-overview-card">
          <span>Reservas filtradas</span>
          <strong>{totalReservations}</strong>
          <p>Registros encontrados com os filtros atuais.</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Pagas no escopo</span>
          <strong>{paidReservations}</strong>
          <p>Reservas com pagamento aprovado pelo provedor.</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Aguardando pagamento</span>
          <strong>{awaitingPaymentReservations}</strong>
          <p>Reservas ainda nao confirmadas.</p>
        </article>
      </div>

      <form action="/admin/reservas" className="admin-form-section admin-reservation-filters">
        <div className="admin-form-grid admin-form-grid--three">
          <label className="admin-form-field">
            <span>Hotel</span>
            <select name="hotelId" defaultValue={selectedHotelId}>
              <option value="">Todos os hoteis</option>
              {hotelOptions.map((hotel) => (
                <option key={hotel.id} value={hotel.id}>
                  {hotel.name}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-form-field">
            <span>Status da reserva</span>
            <select name="status" defaultValue={selectedReservationStatus}>
              <option value="">Todos</option>
              {reservationStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-form-field">
            <span>Status do pagamento</span>
            <select name="paymentStatus" defaultValue={selectedPaymentStatus}>
              <option value="">Todos</option>
              {paymentStatusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="admin-form-field">
            <span>Check-in inicial</span>
            <input name="checkInStart" type="date" defaultValue={filters.checkInStart} />
          </label>

          <label className="admin-form-field">
            <span>Check-in final</span>
            <input name="checkInEnd" type="date" defaultValue={filters.checkInEnd} />
          </label>

          <label className="admin-form-field">
            <span>Hospede</span>
            <input name="q" type="search" defaultValue={filters.q} placeholder="Nome ou e-mail" />
          </label>
        </div>

        <div className="admin-room-actions admin-audit-filter-actions">
          <button type="submit" className="card-cta-button admin-edit-button">
            Filtrar
          </button>
          <Link href="/admin/reservas" className="admin-secondary-button">
            Limpar filtros
          </Link>
        </div>
      </form>

      {reservations.length === 0 ? (
        <div className="hotel-empty-state admin-history-empty">
          <strong>Nenhuma reserva encontrada.</strong>
          <p>Quando houver reservas no seu escopo, elas aparecerao aqui.</p>
        </div>
      ) : (
        <article className="hotel-content-card admin-finance-table-card">
          <div className="admin-finance-table-wrap">
            <table className="admin-finance-table admin-reservations-table">
              <thead>
                <tr>
                  <th scope="col">Hotel</th>
                  <th scope="col">Quarto</th>
                  <th scope="col">Hospede</th>
                  <th scope="col">Check-in</th>
                  <th scope="col">Check-out</th>
                  <th scope="col">Valor</th>
                  <th scope="col">Reserva</th>
                  <th scope="col">Pagamento</th>
                  <th scope="col">Provedor</th>
                  <th scope="col">Criada em</th>
                  <th scope="col">Detalhe</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((reservation) => (
                  <tr key={reservation.id}>
                    <th scope="row">{reservation.hotel.name}</th>
                    <td>{reservation.room.name}</td>
                    <td>
                      <span className="admin-reservation-guest">
                        <strong>{reservation.guestName}</strong>
                        <small>{reservation.guestEmail}</small>
                      </span>
                    </td>
                    <td>{formatDate(reservation.checkIn)}</td>
                    <td>{formatDate(reservation.checkOut)}</td>
                    <td>{formatCurrency(reservation.totalPriceCents, reservation.currency)}</td>
                    <td>
                      <span className={`admin-status-pill is-${reservation.status}`}>
                        {reservationStatusOptions.find(
                          (option) => option.value === reservation.status
                        )?.label ?? reservation.status}
                      </span>
                    </td>
                    <td>
                      <span className={`admin-status-pill is-${reservation.paymentStatus}`}>
                        {paymentStatusOptions.find(
                          (option) => option.value === reservation.paymentStatus
                        )?.label ?? reservation.paymentStatus}
                      </span>
                    </td>
                    <td>{formatProvider(reservation.paymentProvider)}</td>
                    <td>{formatDateTime(reservation.createdAt)}</td>
                    <td>
                      <Link href={`/admin/reservas/${reservation.id}`} className="admin-row-link">
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </article>
      )}

      <nav className="admin-audit-pagination" aria-label="Paginacao das reservas">
        <Link
          href={buildPageHref(Math.max(1, currentPage - 1), {
            ...filters,
            hotelId: selectedHotelId,
            paymentStatus: selectedPaymentStatus,
            status: selectedReservationStatus,
          })}
          className="admin-secondary-button"
          aria-disabled={currentPage <= 1}
        >
          Anterior
        </Link>
        <span>
          Pagina {currentPage} de {totalPages}
        </span>
        <Link
          href={buildPageHref(Math.min(totalPages, currentPage + 1), {
            ...filters,
            hotelId: selectedHotelId,
            paymentStatus: selectedPaymentStatus,
            status: selectedReservationStatus,
          })}
          className="admin-secondary-button"
          aria-disabled={currentPage >= totalPages}
        >
          Proxima
        </Link>
      </nav>
    </section>
  );
}
