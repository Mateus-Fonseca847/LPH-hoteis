"use client";

import { useActionState } from "react";

import { ImageWithFallback } from "@/components/ImageWithFallback";

import type { HotelApprovalState, HotelPublishState } from "./actions";

const initialState: HotelApprovalState = {
  status: "idle",
  message: "",
};

const initialPublishState: HotelPublishState = {
  status: "idle",
  message: "",
};

type FlowStep = {
  label: string;
  description: string;
  href: string;
  status: "complete" | "current" | "pending";
};

type HotelApprovalReviewProps = {
  action: (state: HotelApprovalState, formData: FormData) => Promise<HotelApprovalState>;
  publishAction?: (state: HotelPublishState, formData: FormData) => Promise<HotelPublishState>;
  canPublish: boolean;
  summary: {
    hotelName: string;
    coverImageUrl: string;
    statusLabel: string;
    roomsCount: number;
    ratesCount: number;
    availabilityPeriodsCount: number;
    experiencesCount: number;
    activeExperiencesCount: number;
    experiences: Array<{
      id: string;
      title: string;
      city: string;
      state: string;
      categories: string[];
      isActive: boolean;
    }>;
    pending: string[];
    recommended: string[];
    submittedForApproval: boolean;
    isPublished: boolean;
    hasMapLocation: boolean;
    steps: FlowStep[];
  };
};

export function HotelApprovalReview({
  action,
  publishAction,
  canPublish,
  summary,
}: HotelApprovalReviewProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [publishState, publishFormAction, isPublishing] = useActionState(
    publishAction ?? (async () => initialPublishState),
    initialPublishState
  );
  const canSubmit = summary.pending.length === 0 && !summary.submittedForApproval;
  const canApproveAndPublish =
    canPublish && Boolean(publishAction) && summary.submittedForApproval && !summary.isPublished;

  return (
    <section id="hotel-review" className="hotel-content-card admin-approval-card">
      <div className="admin-flow-steps" aria-label="Etapas de criação do hotel">
        {summary.steps.map((step, index) => (
          <a key={step.href} href={step.href} className={`admin-flow-step is-${step.status}`}>
            <span>{index + 1}</span>
            <strong>{step.label}</strong>
            <small>{step.description}</small>
          </a>
        ))}
      </div>

      <div className="admin-approval-summary">
        <div>
          <h2>{summary.hotelName}</h2>
          <p>Status atual: {summary.statusLabel}</p>
        </div>

        <div className="admin-approval-metrics">
          <span>
            <strong>{summary.roomsCount}</strong>
            quartos
          </span>
          <span>
            <strong>{summary.ratesCount}</strong>
            tarifas
          </span>
          <span>
            <strong>{summary.availabilityPeriodsCount}</strong>
            disponibilidades
          </span>
          <span>
            <strong>{summary.hasMapLocation ? "OK" : "Pendente"}</strong>
            mapa
          </span>
          <span>
            <strong>{summary.activeExperiencesCount}</strong>
            experiências
          </span>
        </div>
      </div>

      <div className="admin-approval-cover">
        {summary.coverImageUrl ? (
          <ImageWithFallback
            src={summary.coverImageUrl}
            alt={`Imagem de capa de ${summary.hotelName}`}
            fallbackLabel={`Imagem indisponível de ${summary.hotelName}`}
            width={960}
            height={360}
            sizes="(max-width: 900px) 100vw, 70vw"
            unoptimized
          />
        ) : (
          <span>Imagem de capa pendente</span>
        )}
      </div>

      {summary.pending.length > 0 ? (
        <div className="admin-editor-banner">
          <strong>Itens obrigatórios pendentes</strong>
          <p>{summary.pending.join(", ")}.</p>
        </div>
      ) : null}

      {summary.recommended.length > 0 ? (
        <div className="admin-editor-banner admin-editor-banner--info">
          <strong>Informações recomendadas</strong>
          <p>
            Você ainda pode adicionar localização e disponibilidade personalizada posteriormente. O
            hotel já pode ser publicado.
          </p>
          <ul>
            {summary.recommended.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="admin-approval-experiences">
        <div>
          <strong>Experiências próximas</strong>
          <p>
            {summary.experiencesCount === 0
              ? "Nenhuma experiência cadastrada ainda."
              : `${summary.experiencesCount} cadastrada(s), ${summary.activeExperiencesCount} ativa(s).`}
          </p>
        </div>
        {summary.experiences.length > 0 ? (
          <div className="admin-approval-experience-list">
            {summary.experiences.map((experience) => (
              <article key={experience.id} className="admin-approval-experience-item">
                <div>
                  <strong>{experience.title}</strong>
                  <p>
                    {experience.city}, {experience.state}
                  </p>
                </div>
                <div className="admin-history-fields">
                  <span className="admin-history-tag">
                    {experience.isActive ? "Ativa" : "Inativa"}
                  </span>
                  {experience.categories.map((category) => (
                    <span key={`${experience.id}-${category}`} className="admin-history-tag">
                      {category}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </div>

      {state.message ? (
        <p
          className={`admin-editor-feedback ${state.status === "success" ? "is-success" : "is-error"}`}
        >
          {state.message}
        </p>
      ) : null}

      {publishState.message ? (
        <p
          className={`admin-editor-feedback ${publishState.status === "success" ? "is-success" : "is-error"}`}
        >
          {publishState.message}
        </p>
      ) : null}

      <form action={formAction} className="admin-approval-actions">
        <button type="submit" className="card-cta-button" disabled={!canSubmit || isPending}>
          {summary.submittedForApproval
            ? "Enviado para aprovação"
            : isPending
              ? "Enviando..."
              : "Enviar para aprovação"}
        </button>
        {summary.isPublished ? <p>Status: Publicado.</p> : null}
        {!summary.isPublished && !summary.submittedForApproval ? (
          <p>Aguardando envio para aprovação.</p>
        ) : null}
      </form>

      {canApproveAndPublish ? (
        <form action={publishFormAction} className="admin-approval-actions">
          <button type="submit" className="card-cta-button" disabled={isPublishing}>
            {isPublishing ? "Publicando..." : "Aprovar e publicar"}
          </button>
        </form>
      ) : null}

      {!canPublish && summary.submittedForApproval && !summary.isPublished ? (
        <div className="admin-editor-banner">
          <strong>Aprovação pendente</strong>
          <p>Somente o super administrador pode aprovar e publicar este hotel.</p>
        </div>
      ) : null}
    </section>
  );
}
