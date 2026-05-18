import type { PaymentProvider, PaymentStatus, ReservationStatus } from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type AdminReservationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

const reservationStatusLabels: Record<ReservationStatus, string> = {
  pending: "Pendente",
  awaiting_payment: "Aguardando pagamento",
  confirmed: "Confirmada",
  paid: "Paga",
  payment_failed: "Pagamento falhou",
  cancelled: "Cancelada",
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  pending: "Pendente",
  awaiting_payment: "Aguardando pagamento",
  paid: "Pago",
  payment_failed: "Falhou",
  cancelled: "Cancelado",
};

const providerLabels: Record<PaymentProvider, string> = {
  manual: "Manual",
  mercado_pago: "Mercado Pago",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(value);
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "Nao informado";
  }

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

function formatPaymentMethod(method: string | null) {
  if (!method) {
    return "Nao informado";
  }

  const labels: Record<string, string> = {
    account_money: "Saldo em conta",
    boleto: "Boleto",
    credit_card: "Cartao de credito",
    debit_card: "Cartao de debito",
    pix: "Pix",
    ticket: "Boleto",
  };

  return labels[method] ?? method.replaceAll("_", " ");
}

export default async function AdminReservationDetailPage({
  params,
}: AdminReservationDetailPageProps) {
  const { id } = await params;
  let user;

  try {
    user = await requireAdminRouteSession(`/admin/reservas/${id}`);
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

  const reservation = await prisma.reservation.findFirst({
    where: {
      id,
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
          email: true,
          name: true,
          phone: true,
          slug: true,
          whatsapp: true,
        },
      },
      paymentTransaction: true,
      room: {
        select: {
          name: true,
        },
      },
    },
  });

  if (!reservation) {
    notFound();
  }

  const timeline = [
    {
      label: "Reserva criada",
      value: formatDateTime(reservation.createdAt),
    },
    {
      label: "Pagamento aprovado",
      value: formatDateTime(reservation.paidAt),
    },
    {
      label: "Ultima atualizacao",
      value: formatDateTime(reservation.updatedAt),
    },
  ];

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Reserva</span>
        <h1>{reservation.guestName}</h1>
        <p className="admin-rooms-copy">
          Detalhe operacional somente leitura. Confirmacao de pagamento depende do webhook do
          provedor.
        </p>
      </div>

      <div className="admin-overview-grid">
        <article className="hotel-content-card admin-overview-card">
          <span>Status da reserva</span>
          <strong>{reservationStatusLabels[reservation.status]}</strong>
          <p>{reservation.availabilityHeld ? "Disponibilidade retida." : "Sem hold ativo."}</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Status do pagamento</span>
          <strong>{paymentStatusLabels[reservation.paymentStatus]}</strong>
          <p>{formatProvider(reservation.paymentProvider)}</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Valor total</span>
          <strong>{formatCurrency(reservation.totalPriceCents, reservation.currency)}</strong>
          <p>
            {reservation.nights} noite(s), diaria{" "}
            {formatCurrency(reservation.nightlyPriceCents, reservation.currency)}.
          </p>
        </article>
      </div>

      <section className="hotel-content-card admin-reservation-detail-card">
        <div className="admin-audit-meta">
          <p>
            <span>Hotel</span>
            <strong>{reservation.hotel.name}</strong>
          </p>
          <p>
            <span>Quarto</span>
            <strong>{reservation.room.name}</strong>
          </p>
          <p>
            <span>Periodo</span>
            <strong>
              {formatDate(reservation.checkIn)} a {formatDate(reservation.checkOut)}
            </strong>
          </p>
        </div>

        <div className="admin-audit-meta">
          <p>
            <span>Hospede</span>
            <strong>{reservation.guestName}</strong>
          </p>
          <p>
            <span>E-mail</span>
            <strong>{reservation.guestEmail}</strong>
          </p>
          <p>
            <span>Telefone</span>
            <strong>{reservation.guestPhone}</strong>
          </p>
        </div>

        <div className="admin-audit-meta">
          <p>
            <span>Hospedes</span>
            <strong>
              {reservation.adults} adulto(s), {reservation.children} crianca(s)
            </strong>
          </p>
          <p>
            <span>Documento</span>
            <strong>{reservation.guestDocument || "Nao informado"}</strong>
          </p>
          <p>
            <span>Teste</span>
            <strong>{reservation.isTestData ? "Sim" : "Nao"}</strong>
          </p>
        </div>

        <div className="admin-audit-meta">
          <p>
            <span>Metodo</span>
            <strong>{formatPaymentMethod(reservation.paymentMethod)}</strong>
          </p>
          <p>
            <span>ID pagamento</span>
            <strong>{reservation.providerPaymentId || "Nao informado"}</strong>
          </p>
          <p>
            <span>Stripe legado</span>
            <strong>
              {reservation.stripeCheckoutSessionId ||
                reservation.stripePaymentIntentId ||
                "Nao informado"}
            </strong>
          </p>
        </div>
      </section>

      <section className="hotel-content-card admin-reservation-detail-card">
        <div className="admin-finance-chart__header">
          <div>
            <h3>Historico basico</h3>
          </div>
          <p>Eventos inferidos dos campos gravados na reserva.</p>
        </div>

        <div className="admin-history-list">
          {timeline.map((item) => (
            <article key={item.label} className="admin-history-item">
              <div className="admin-history-item-top">
                <strong>{item.label}</strong>
                <span>{item.value}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      {reservation.paymentTransaction ? (
        <section className="hotel-content-card admin-reservation-detail-card">
          <div className="admin-finance-chart__header">
            <div>
              <h3>Transacao financeira</h3>
            </div>
            <p>Valores registrados para conciliacao interna.</p>
          </div>

          <div className="admin-audit-meta">
            <p>
              <span>Bruto</span>
              <strong>
                {formatCurrency(
                  reservation.paymentTransaction.grossAmountCents,
                  reservation.paymentTransaction.currency
                )}
              </strong>
            </p>
            <p>
              <span>Comissao</span>
              <strong>
                {formatCurrency(
                  reservation.paymentTransaction.platformFeeCents,
                  reservation.paymentTransaction.currency
                )}
              </strong>
            </p>
            <p>
              <span>Liquido hotel</span>
              <strong>
                {formatCurrency(
                  reservation.paymentTransaction.hotelNetAmountCents,
                  reservation.paymentTransaction.currency
                )}
              </strong>
            </p>
          </div>
        </section>
      ) : null}

      <Link href="/admin/reservas" className="hotel-page-back">
        Voltar para reservas
      </Link>
    </section>
  );
}
