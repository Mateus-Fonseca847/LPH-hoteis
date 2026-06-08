import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

import {
  approveHotelOwnerSignupRequestAction,
  rejectHotelOwnerSignupRequestAction,
} from "./actions";
import { ReviewRequestForm } from "./ReviewRequestForm";

type SignupRequest = Awaited<ReturnType<typeof getSignupRequests>>[number];

function formatStatus(status: SignupRequest["status"]) {
  if (status === "approved") {
    return "Aprovada";
  }

  if (status === "rejected") {
    return "Rejeitada";
  }

  return "Pendente";
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(value);
}

async function getSignupRequests() {
  return prisma.hotelOwnerSignupRequest.findMany({
    select: {
      id: true,
      responsibleName: true,
      email: true,
      phone: true,
      hotelName: true,
      hotelCity: true,
      hotelState: true,
      hotelDocument: true,
      message: true,
      status: true,
      createdAt: true,
      reviewedAt: true,
      reviewNote: true,
      createdUserId: true,
      reviewedBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
  });
}

function RequestCard({ request }: { request: SignupRequest }) {
  const approveAction = approveHotelOwnerSignupRequestAction.bind(null, request.id);
  const rejectAction = rejectHotelOwnerSignupRequestAction.bind(null, request.id);

  return (
    <article className="hotel-content-card admin-hotel-card admin-admin-card">
      <div className="admin-hotel-card-top">
        <span>{formatStatus(request.status)}</span>
        <strong>{request.responsibleName}</strong>
        <p>{request.email}</p>
      </div>

      <div className="admin-hotel-card-meta admin-admin-meta">
        <p>
          <span>Telefone</span>
          <strong>{request.phone}</strong>
        </p>
        <p>
          <span>Hotel pretendido</span>
          <strong>{request.hotelName}</strong>
        </p>
        <p>
          <span>Cidade/estado</span>
          <strong>
            {request.hotelCity}/{request.hotelState}
          </strong>
        </p>
        <p>
          <span>Envio</span>
          <strong>{formatDate(request.createdAt)}</strong>
        </p>
      </div>

      {request.hotelDocument ? (
        <p className="admin-rooms-copy">Documento: {request.hotelDocument}</p>
      ) : null}

      {request.message ? (
        <div className="admin-editor-banner">
          <strong>Mensagem</strong>
          <p>{request.message}</p>
        </div>
      ) : null}

      {request.status === "pending" ? (
        <ReviewRequestForm approveAction={approveAction} rejectAction={rejectAction} />
      ) : (
        <div className="admin-editor-banner">
          <strong>Revisão</strong>
          <p>
            {request.reviewedAt ? formatDate(request.reviewedAt) : "Sem data de revisão"}
            {request.reviewedBy
              ? ` por ${request.reviewedBy.name || request.reviewedBy.email}`
              : ""}
          </p>
          {request.reviewNote ? <p>{request.reviewNote}</p> : null}
          {request.createdUserId ? <p>Usuário criado: {request.createdUserId}</p> : null}
        </div>
      )}
    </article>
  );
}

function RequestSection({
  title,
  emptyText,
  requests,
}: {
  title: string;
  emptyText: string;
  requests: SignupRequest[];
}) {
  return (
    <section className="admin-form-section">
      <div className="admin-subsection-heading">
        <h2>{title}</h2>
      </div>

      {requests.length === 0 ? (
        <div className="hotel-empty-state admin-history-empty">
          <strong>{emptyText}</strong>
        </div>
      ) : (
        <div className="admin-hotels-grid admin-admins-grid">
          {requests.map((request) => (
            <RequestCard key={request.id} request={request} />
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AdminSignupRequestsPage() {
  let user;

  try {
    user = await requireAdminRouteSession("/admin/solicitacoes-acesso");
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  if (user.globalRole !== "super_admin") {
    return (
      <AdminAccessDenied
        title="Acesso restrito"
        description="Somente super_admin pode revisar solicitações de acesso."
      />
    );
  }

  const requests = await getSignupRequests();
  const pendingRequests = requests.filter((request) => request.status === "pending");
  const approvedRequests = requests.filter((request) => request.status === "approved");
  const rejectedRequests = requests.filter((request) => request.status === "rejected");

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <h1>Solicitações de acesso</h1>
        <p className="admin-rooms-copy">
          Analise pedidos de donos de hotéis e aprove apenas contas administrativas válidas.
        </p>
      </div>

      <RequestSection
        title="Pendentes"
        emptyText="Nenhuma solicitação pendente."
        requests={pendingRequests}
      />
      <RequestSection
        title="Aprovadas"
        emptyText="Nenhuma solicitação aprovada."
        requests={approvedRequests}
      />
      <RequestSection
        title="Rejeitadas"
        emptyText="Nenhuma solicitação rejeitada."
        requests={rejectedRequests}
      />
    </section>
  );
}
