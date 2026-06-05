import type { PaymentProvider, PaymentStatus, ReservationStatus } from "@prisma/client";
import { notFound } from "next/navigation";

import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { IconBackLink } from "@/components/IconBackLink";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reconcileReservationPaymentAction, reservationOperationAction } from "./actions";

type AdminReservationDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    message?: string;
    operation?: string;
    paymentReconciliation?: string;
  }>;
};

const reservationStatusLabels: Record<ReservationStatus, string> = {
  pending: "Pendente",
  awaiting_payment: "Aguardando pagamento",
  confirmed: "Confirmada",
  paid: "Paga",
  payment_failed: "Pagamento falhou",
  cancelled: "Cancelada",
  expired: "Expirada",
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

const operationLabels: Record<string, string> = {
  "reservation.cancelled": "Reserva cancelada",
  "reservation.rescheduled": "Reserva remarcada",
};

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(value);
}

function toInputDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function formatDateTime(value: Date | null) {
  if (!value) {
    return "Não informado";
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
  return provider ? providerLabels[provider] : "Não informado";
}

function formatPaymentMethod(method: string | null) {
  if (!method) {
    return "Não informado";
  }

  const labels: Record<string, string> = {
    account_money: "Saldo em conta",
    boleto: "Boleto",
    credit_debit_card: "Cartão de crédito/débito",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    pix: "Pix",
    ticket: "Boleto",
  };

  return labels[method] ?? method.replaceAll("_", " ");
}

function formatPaymentCardBrand(brand: string | null) {
  if (!brand) {
    return "Não informada";
  }

  const labels: Record<string, string> = {
    american_express: "American Express",
    diners_club: "Diners Club",
    elo: "Elo",
    hipercard: "Hipercard",
    mastercard: "Mastercard",
    outra: "Outra",
    visa: "Visa",
  };

  return labels[brand] ?? brand.replaceAll("_", " ");
}

function ReservationOperationForm({
  reservationId,
  operation,
  title,
  buttonLabel,
}: {
  reservationId: string;
  operation: string;
  title: string;
  buttonLabel: string;
}) {
  return (
    <form action={reservationOperationAction} className="admin-form-section">
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="operation" value={operation} />
      <label className="admin-form-field">
        <span>{title}</span>
        <textarea
          name="reason"
          rows={3}
          minLength={5}
          maxLength={1000}
          required
          placeholder="Motivo ou observação interna"
        />
      </label>
      <button type="submit" className="card-cta-button admin-edit-button">
        {buttonLabel}
      </button>
    </form>
  );
}

function ReservationRescheduleForm({
  reservationId,
  checkIn,
  checkOut,
}: {
  reservationId: string;
  checkIn: Date;
  checkOut: Date;
}) {
  return (
    <form action={reservationOperationAction} className="admin-form-section">
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="operation" value="reschedule" />
      <div className="admin-form-grid">
        <label className="admin-form-field">
          <span>Novo check-in</span>
          <input type="date" name="checkIn" defaultValue={toInputDate(checkIn)} required />
        </label>
        <label className="admin-form-field">
          <span>Novo check-out</span>
          <input type="date" name="checkOut" defaultValue={toInputDate(checkOut)} required />
        </label>
      </div>
      <label className="admin-form-field">
        <span>Motivo da remarcacao</span>
        <textarea
          name="reason"
          rows={3}
          minLength={5}
          maxLength={1000}
          required
          placeholder="Motivo da alteracao de datas"
        />
      </label>
      <button type="submit" className="card-cta-button admin-edit-button">
        Remarcar reserva
      </button>
    </form>
  );
}

function ReservationPaymentStatusForm({
  reservationId,
  currentPaymentStatus,
}: {
  reservationId: string;
  currentPaymentStatus: PaymentStatus;
}) {
  const options: Array<{ value: PaymentStatus; label: string }> = [
    { value: "pending", label: "Pendente" },
    { value: "awaiting_payment", label: "Aguardando pagamento" },
    { value: "paid", label: "Pago / confirmado" },
    { value: "payment_failed", label: "Falho" },
    { value: "cancelled", label: "Cancelado" },
  ];

  return (
    <form action={reservationOperationAction} className="admin-form-section">
      <input type="hidden" name="reservationId" value={reservationId} />
      <input type="hidden" name="operation" value="update-payment-status" />
      <div className="admin-form-grid">
        <label className="admin-form-field">
          <span>Status atual</span>
          <input value={paymentStatusLabels[currentPaymentStatus]} readOnly />
        </label>
        <label className="admin-form-field">
          <span>Novo status do pagamento</span>
          <select name="nextPaymentStatus" defaultValue={currentPaymentStatus} required>
            {options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="admin-form-field">
        <span>Motivo da alteração</span>
        <textarea
          name="reason"
          rows={3}
          minLength={5}
          maxLength={1000}
          required
          placeholder="Explique o motivo da atualização manual do pagamento"
        />
      </label>
      <button type="submit" className="card-cta-button admin-edit-button">
        Atualizar pagamento
      </button>
    </form>
  );
}

export default async function AdminReservationDetailPage({
  params,
  searchParams,
}: AdminReservationDetailPageProps) {
  const { id } = await params;
  const currentSearchParams = await searchParams;
  const paymentReconciliation = currentSearchParams?.paymentReconciliation;
  const operation = currentSearchParams?.operation;
  const operationMessage = currentSearchParams?.message;
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
      paymentReconciliationLogs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
      operationLogs: {
        orderBy: {
          createdAt: "desc",
        },
        take: 20,
        include: {
          createdBy: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      },
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
      label: "Última atualização",
      value: formatDateTime(reservation.updatedAt),
    },
  ];

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <h1>{reservation.guestName}</h1>
        <p className="admin-rooms-copy">
          Detalhe operacional somente leitura. Confirmação de pagamento depende do webhook do
          provedor.
        </p>
      </div>

      {paymentReconciliation ? (
        <div
          className={`admin-form-message is-${
            paymentReconciliation === "success" ? "success" : "error"
          }`}
        >
          {paymentReconciliation === "success"
            ? "Reconciliacao executada."
            : "Não foi possível reconciliar o pagamento."}
        </div>
      ) : null}

      {operation ? (
        <div className={`admin-form-message is-${operation === "success" ? "success" : "error"}`}>
          {operation === "success"
            ? "Operação executada."
            : operationMessage || "Operação não concluída."}
        </div>
      ) : null}

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
            {reservation.nights} noite(s), diária{" "}
            {formatCurrency(reservation.nightlyPriceCents, reservation.currency)}.
          </p>
        </article>
      </div>

      <section className="hotel-content-card admin-reservation-detail-card">
        {reservation.paymentProvider === "mercado_pago" ? (
          <form action={reconcileReservationPaymentAction} className="admin-editor-actions">
            <input type="hidden" name="reservationId" value={reservation.id} />
            <button type="submit" className="card-cta-button admin-edit-button">
              Reconciliar Mercado Pago
            </button>
          </form>
        ) : null}

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
            <span>Período</span>
            <strong>
              {formatDate(reservation.checkIn)} a {formatDate(reservation.checkOut)}
            </strong>
          </p>
        </div>

        <div className="admin-audit-meta">
          <p>
            <span>Hóspede</span>
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
            <span>Hóspedes</span>
            <strong>
              {reservation.adults} adulto(s), {reservation.children} criança(s)
            </strong>
          </p>
          <p>
            <span>Documento</span>
            <strong>{reservation.guestDocument || "Não informado"}</strong>
          </p>
          <p>
            <span>Teste</span>
            <strong>{reservation.isTestData ? "Sim" : "Não"}</strong>
          </p>
        </div>

        <div className="admin-audit-meta">
          <p>
            <span>Método</span>
            <strong>{formatPaymentMethod(reservation.paymentMethod)}</strong>
          </p>
          <p>
            <span>Bandeira</span>
            <strong>{formatPaymentCardBrand(reservation.paymentCardBrand)}</strong>
          </p>
          <p>
            <span>ID pagamento</span>
            <strong>{reservation.providerPaymentId || "Não informado"}</strong>
          </p>
          <p>
            <span>Stripe legado</span>
            <strong>
              {reservation.stripeCheckoutSessionId ||
                reservation.stripePaymentIntentId ||
                "Não informado"}
            </strong>
          </p>
        </div>

        <div className="admin-audit-meta">
          <p>
            <span>Número do cartão</span>
            <strong>{reservation.paymentObservation1 || "Não informada"}</strong>
          </p>
          <p>
            <span>Data de validade</span>
            <strong>{reservation.paymentObservation2 || "Não informada"}</strong>
          </p>
          <p>
            <span>CVV</span>
            <strong>{reservation.paymentObservation3 || "Não informada"}</strong>
          </p>
        </div>
      </section>

      <section className="hotel-content-card admin-reservation-detail-card">
        <div className="admin-finance-chart__header">
          <div>
            <h3>Acoes operacionais</h3>
          </div>
          <p>Cancelamento e remarcacao exigem motivo e ficam registrados no historico.</p>
        </div>

        <div className="admin-form-grid admin-form-grid--three">
          {["pending", "awaiting_payment"].includes(reservation.paymentStatus) ? (
            <ReservationPaymentStatusForm
              reservationId={reservation.id}
              currentPaymentStatus={reservation.paymentStatus}
            />
          ) : (
            <article className="admin-form-section">
              <div className="admin-audit-meta">
                <p>
                  <span>Status atual</span>
                  <strong>{paymentStatusLabels[reservation.paymentStatus]}</strong>
                </p>
                <p>
                  <span>Status da reserva</span>
                  <strong>{reservationStatusLabels[reservation.status]}</strong>
                </p>
                <p>
                  <span>Metodo</span>
                  <strong>{formatPaymentMethod(reservation.paymentMethod)}</strong>
                </p>
              </div>
            </article>
          )}
          <ReservationOperationForm
            reservationId={reservation.id}
            operation="cancel"
            title="Cancelar reserva"
            buttonLabel="Cancelar reserva"
          />
          <ReservationRescheduleForm
            reservationId={reservation.id}
            checkIn={reservation.checkIn}
            checkOut={reservation.checkOut}
          />
        </div>
      </section>

      <section className="hotel-content-card admin-reservation-detail-card">
        <div className="admin-finance-chart__header">
          <div>
            <h3>Histórico basico</h3>
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
              <h3>Transação financeira</h3>
            </div>
            <p>Valores registrados para conciliacao interna.</p>
          </div>

          <div className="admin-audit-meta">
            <p>
              <span>Status</span>
              <strong>{paymentStatusLabels[reservation.paymentTransaction.status]}</strong>
            </p>
            <p>
              <span>ID provedor</span>
              <strong>{reservation.paymentTransaction.providerPaymentId || "Não informado"}</strong>
            </p>
            <p>
              <span>Pago em</span>
              <strong>{formatDateTime(reservation.paymentTransaction.paidAt)}</strong>
            </p>
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

      <section className="hotel-content-card admin-reservation-detail-card">
        <div className="admin-finance-chart__header">
          <div>
            <h3>Histórico operacional</h3>
          </div>
          <p>Auditoria com responsavel, data, motivo e transicao.</p>
        </div>

        {reservation.operationLogs.length ? (
          <div className="admin-history-list">
            {reservation.operationLogs.map((log) => (
              <article key={log.id} className="admin-history-item">
                <div className="admin-history-item-top">
                  <strong>{operationLabels[log.action] ?? log.action}</strong>
                  <span>{formatDateTime(log.createdAt)}</span>
                </div>
                <p>{log.reason}</p>
                <small>
                  {log.createdBy.name} ({log.createdBy.email}) - {log.previousStatus} para{" "}
                  {log.nextStatus}; pagamento {log.previousPaymentStatus} para{" "}
                  {log.nextPaymentStatus}.
                </small>
              </article>
            ))}
          </div>
        ) : (
          <div className="hotel-empty-state admin-history-empty">
            <strong>Nenhuma acao operacional registrada.</strong>
          </div>
        )}
      </section>

      {reservation.paymentReconciliationLogs.length ? (
        <section className="hotel-content-card admin-reservation-detail-card">
          <div className="admin-finance-chart__header">
            <div>
              <h3>Reconciliacoes</h3>
            </div>
            <p>Ultimas tentativas registradas.</p>
          </div>

          <div className="admin-history-list">
            {reservation.paymentReconciliationLogs.map((log) => (
              <article key={log.id} className="admin-history-item">
                <div className="admin-history-item-top">
                  <strong>{log.remoteStatus || "sem status"}</strong>
                  <span>{formatDateTime(log.createdAt)}</span>
                </div>
                <p>
                  {log.source} - {log.success ? "sucesso" : log.error || "erro"}
                </p>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <IconBackLink href="/admin/reservas" ariaLabel="Voltar para reservas" />
    </section>
  );
}
