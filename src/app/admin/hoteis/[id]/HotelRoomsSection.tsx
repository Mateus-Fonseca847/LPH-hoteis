"use client";

import Image from "next/image";
import { useState, useTransition } from "react";

import type { AuthorizedHotelRoom, HotelRoomActionState } from "./room-actions";
import {
  createHotelRoomAction,
  listHotelRoomsAction,
  toggleHotelRoomActiveAction,
  updateHotelRoomAction,
} from "./room-actions";
import { createHotelRoomPayloadSchema } from "@/lib/validations/room";

type RoomFormValues = {
  name: string;
  description: string;
  imageUrl: string;
  capacityAdults: string;
  capacityChildren: string;
  beds: string;
  sizeM2: string;
  amenities: string;
  isActive: boolean;
};

type RoomFormErrors = Partial<Record<Exclude<keyof RoomFormValues, "isActive">, string>> & {
  general?: string;
};

type RoomFormMode = "create" | "edit";

type RoomFormCardProps = {
  mode: RoomFormMode;
  values: RoomFormValues;
  errors: RoomFormErrors;
  pending: boolean;
  title: string;
  submitLabel: string;
  onChange: (field: keyof RoomFormValues, value: string | boolean) => void;
  onSubmit: () => void;
  onCancel: () => void;
};

type HotelRoomsSectionProps = {
  hotelId: string;
  initialRooms: AuthorizedHotelRoom[];
};

const EMPTY_FORM: RoomFormValues = {
  name: "",
  description: "",
  imageUrl: "",
  capacityAdults: "2",
  capacityChildren: "0",
  beds: "",
  sizeM2: "25",
  amenities: "",
  isActive: true,
};

function getRoomFormValues(room: AuthorizedHotelRoom): RoomFormValues {
  return {
    name: room.name,
    description: room.description,
    imageUrl: room.imageUrl,
    capacityAdults: String(room.capacityAdults),
    capacityChildren: String(room.capacityChildren),
    beds: room.beds,
    sizeM2: String(room.sizeM2 ?? ""),
    amenities: room.amenities.join("\n"),
    isActive: room.isActive,
  };
}

function buildRoomPayload(values: RoomFormValues) {
  return {
    name: values.name.trim(),
    description: values.description.trim(),
    imageUrl: values.imageUrl.trim(),
    capacityAdults: Number(values.capacityAdults),
    capacityChildren: Number(values.capacityChildren),
    beds: values.beds.trim(),
    sizeM2: Number(values.sizeM2),
    amenities: values.amenities
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean),
    isActive: values.isActive,
  };
}

function validateRoomForm(values: RoomFormValues): RoomFormErrors {
  const result = createHotelRoomPayloadSchema.safeParse(buildRoomPayload(values));

  if (result.success) {
    return {};
  }

  const nextErrors: RoomFormErrors = {};

  for (const issue of result.error.issues) {
    const field = issue.path[0];

    if (typeof field === "string" && !(field in nextErrors)) {
      nextErrors[field as keyof RoomFormErrors] = issue.message;
    }
  }

  return nextErrors;
}

function formatCapacity(room: AuthorizedHotelRoom) {
  const parts = [`${room.capacityAdults} adulto${room.capacityAdults > 1 ? "s" : ""}`];

  if (room.capacityChildren > 0) {
    parts.push(`${room.capacityChildren} criança${room.capacityChildren > 1 ? "s" : ""}`);
  }

  return parts.join(" + ");
}

function RoomFormCard({
  mode,
  values,
  errors,
  pending,
  title,
  submitLabel,
  onChange,
  onSubmit,
  onCancel,
}: RoomFormCardProps) {
  return (
    <div className={`admin-room-panel ${mode === "edit" ? "admin-room-panel--inline" : ""}`}>
      <div className="admin-room-panel-heading">
        <strong>{title}</strong>
      </div>

      {errors.general ? (
        <p className="admin-form-error admin-form-error--block">{errors.general}</p>
      ) : null}

      <div className="admin-form-grid admin-form-grid--two">
        <label className="admin-form-field">
          <span>Nome</span>
          <input
            value={values.name}
            onChange={(event) => onChange("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name ? <small className="admin-form-error">{errors.name}</small> : null}
        </label>

        <label className="admin-form-field">
          <span>Imagem</span>
          <input
            value={values.imageUrl}
            onChange={(event) => onChange("imageUrl", event.target.value)}
            aria-invalid={Boolean(errors.imageUrl)}
            placeholder="https://..."
          />
          <small>Use a URL de uma imagem já disponível para o quarto.</small>
          {errors.imageUrl ? <small className="admin-form-error">{errors.imageUrl}</small> : null}
        </label>

        <label className="admin-form-field admin-form-field--full">
          <span>Descrição</span>
          <textarea
            rows={4}
            value={values.description}
            onChange={(event) => onChange("description", event.target.value)}
            aria-invalid={Boolean(errors.description)}
          />
          {errors.description ? (
            <small className="admin-form-error">{errors.description}</small>
          ) : null}
        </label>

        <label className="admin-form-field">
          <span>Adultos</span>
          <input
            type="number"
            min="1"
            value={values.capacityAdults}
            onChange={(event) => onChange("capacityAdults", event.target.value)}
            aria-invalid={Boolean(errors.capacityAdults)}
          />
          {errors.capacityAdults ? (
            <small className="admin-form-error">{errors.capacityAdults}</small>
          ) : null}
        </label>

        <label className="admin-form-field">
          <span>Crianças</span>
          <input
            type="number"
            min="0"
            value={values.capacityChildren}
            onChange={(event) => onChange("capacityChildren", event.target.value)}
            aria-invalid={Boolean(errors.capacityChildren)}
          />
          {errors.capacityChildren ? (
            <small className="admin-form-error">{errors.capacityChildren}</small>
          ) : null}
        </label>

        <label className="admin-form-field">
          <span>Camas</span>
          <input
            value={values.beds}
            onChange={(event) => onChange("beds", event.target.value)}
            aria-invalid={Boolean(errors.beds)}
            placeholder="Ex.: 1 cama queen"
          />
          {errors.beds ? <small className="admin-form-error">{errors.beds}</small> : null}
        </label>

        <label className="admin-form-field">
          <span>Tamanho em m²</span>
          <input
            type="number"
            min="1"
            value={values.sizeM2}
            onChange={(event) => onChange("sizeM2", event.target.value)}
            aria-invalid={Boolean(errors.sizeM2)}
          />
          {errors.sizeM2 ? <small className="admin-form-error">{errors.sizeM2}</small> : null}
        </label>

        <label className="admin-form-field admin-form-field--full">
          <span>Comodidades</span>
          <textarea
            rows={4}
            value={values.amenities}
            onChange={(event) => onChange("amenities", event.target.value)}
            aria-invalid={Boolean(errors.amenities)}
          />
          <small>Uma comodidade por linha.</small>
          {errors.amenities ? <small className="admin-form-error">{errors.amenities}</small> : null}
        </label>
      </div>

      <label className="admin-toggle-field">
        <input
          type="checkbox"
          checked={values.isActive}
          onChange={(event) => onChange("isActive", event.target.checked)}
        />
        <span>Quarto ativo</span>
      </label>

      <div className="admin-room-actions">
        <button
          type="button"
          className="card-cta-button admin-edit-button"
          onClick={onSubmit}
          disabled={pending}
        >
          {pending ? "Salvando..." : submitLabel}
        </button>

        <button
          type="button"
          className="admin-secondary-button"
          onClick={onCancel}
          disabled={pending}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

export function HotelRoomsSection({ hotelId, initialRooms }: HotelRoomsSectionProps) {
  const [rooms, setRooms] = useState(initialRooms);
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [createForm, setCreateForm] = useState<RoomFormValues>(EMPTY_FORM);
  const [editForm, setEditForm] = useState<RoomFormValues>(EMPTY_FORM);
  const [createErrors, setCreateErrors] = useState<RoomFormErrors>({});
  const [editErrors, setEditErrors] = useState<RoomFormErrors>({});
  const [pendingRoomId, setPendingRoomId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refreshRooms = async () => {
    const result = await listHotelRoomsAction(hotelId);

    if (result.status === "error") {
      throw new Error(result.message || "Não foi possível atualizar a lista de quartos.");
    }

    setRooms(result.rooms);
  };

  const runRoomTask = (
    task: () => Promise<HotelRoomActionState>,
    options?: {
      roomId?: string | null;
      onSuccess?: () => void;
    }
  ) => {
    setFeedback("");
    setPendingRoomId(options?.roomId ?? null);

    startTransition(async () => {
      try {
        const result = await task();

        if (result.status === "error") {
          throw new Error(result.message || "Não foi possível concluir a operação.");
        }

        await refreshRooms();
        options?.onSuccess?.();
        setFeedbackType("success");
        setFeedback(result.message);
      } catch (error) {
        setFeedbackType("error");
        setFeedback(
          error instanceof Error ? error.message : "Não foi possível concluir a operação."
        );
      } finally {
        setPendingRoomId(null);
      }
    });
  };

  const handleCreateSubmit = () => {
    const nextErrors = validateRoomForm(createForm);
    setCreateErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFeedback("");
      return;
    }

    runRoomTask(() => createHotelRoomAction(hotelId, buildRoomPayload(createForm)), {
      onSuccess: () => {
        setIsCreating(false);
        setCreateForm(EMPTY_FORM);
        setCreateErrors({});
      },
    });
  };

  const handleEditSubmit = (roomId: string) => {
    const nextErrors = validateRoomForm(editForm);
    setEditErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setFeedback("");
      return;
    }

    runRoomTask(() => updateHotelRoomAction(hotelId, roomId, buildRoomPayload(editForm)), {
      roomId,
      onSuccess: () => {
        setEditingRoomId(null);
        setEditForm(EMPTY_FORM);
        setEditErrors({});
      },
    });
  };

  const handleCreateChange = (field: keyof RoomFormValues, value: string | boolean) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
    setCreateErrors((current) => ({ ...current, [field]: undefined, general: undefined }));
  };

  const handleEditChange = (field: keyof RoomFormValues, value: string | boolean) => {
    setEditForm((current) => ({ ...current, [field]: value }));
    setEditErrors((current) => ({ ...current, [field]: undefined, general: undefined }));
  };

  return (
    <section className="hotel-content-card admin-form-section admin-rooms-section">
      <div className="admin-rooms-header">
        <div className="section-heading admin-subsection-heading">
          <h2>Quartos</h2>
          <p className="admin-rooms-copy">
            Gerencie os quartos deste hotel com criação, edição e controle de status.
          </p>
        </div>

        <button
          type="button"
          className="card-cta-button admin-edit-button"
          onClick={() => {
            setIsCreating((current) => !current);
            setEditingRoomId(null);
            setCreateForm(EMPTY_FORM);
            setCreateErrors({});
            setEditErrors({});
          }}
          disabled={isPending}
        >
          {isCreating ? "Fechar" : "Adicionar quarto"}
        </button>
      </div>

      {feedback ? (
        <p
          className={`admin-editor-feedback ${feedbackType === "success" ? "is-success" : "is-error"}`}
          role={feedbackType === "error" ? "alert" : "status"}
        >
          {feedback}
        </p>
      ) : null}

      {isCreating ? (
        <RoomFormCard
          mode="create"
          title="Novo quarto"
          submitLabel="Salvar quarto"
          values={createForm}
          errors={createErrors}
          pending={isPending && pendingRoomId === null}
          onChange={handleCreateChange}
          onSubmit={handleCreateSubmit}
          onCancel={() => {
            setIsCreating(false);
            setCreateForm(EMPTY_FORM);
            setCreateErrors({});
          }}
        />
      ) : null}

      {rooms.length === 0 ? (
        <div className="hotel-empty-state admin-history-empty">
          <strong>Nenhum quarto cadastrado.</strong>
          <p>Adicione o primeiro quarto para começar a operação deste hotel.</p>
        </div>
      ) : (
        <div className="admin-rooms-list">
          {rooms.map((room) => {
            const isEditing = editingRoomId === room.id;
            const isRoomPending = pendingRoomId === room.id;

            return (
              <article key={room.id} className="admin-room-card">
                <div className="admin-room-card-media">
                  <Image src={room.imageUrl} alt={room.name} fill sizes="260px" unoptimized />
                </div>

                <div className="admin-room-card-body">
                  <div className="admin-room-card-top">
                    <div>
                      <strong>{room.name}</strong>
                      <p>{formatCapacity(room)}</p>
                    </div>

                    <span
                      className={`admin-room-badge ${room.isActive ? "is-active" : "is-inactive"}`}
                    >
                      {room.isActive ? "Ativo" : "Inativo"}
                    </span>
                  </div>

                  <div className="admin-room-meta-grid">
                    <span>{room.beds}</span>
                    <span>{room.sizeM2 ? `${room.sizeM2} m²` : room.size}</span>
                    <span>{room.amenities.length} comodidades</span>
                  </div>

                  {isEditing ? (
                    <RoomFormCard
                      mode="edit"
                      title={`Editar ${room.name}`}
                      submitLabel="Salvar"
                      values={editForm}
                      errors={editErrors}
                      pending={isRoomPending}
                      onChange={handleEditChange}
                      onSubmit={() => handleEditSubmit(room.id)}
                      onCancel={() => {
                        setEditingRoomId(null);
                        setEditForm(EMPTY_FORM);
                        setEditErrors({});
                      }}
                    />
                  ) : (
                    <>
                      <p className="admin-room-description">{room.description}</p>

                      <div className="admin-room-actions">
                        <button
                          type="button"
                          className="admin-secondary-button"
                          onClick={() => {
                            setIsCreating(false);
                            setEditingRoomId(room.id);
                            setEditForm(getRoomFormValues(room));
                            setEditErrors({});
                          }}
                          disabled={isPending}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="admin-secondary-button"
                          onClick={() =>
                            runRoomTask(
                              () => toggleHotelRoomActiveAction(hotelId, room.id, !room.isActive),
                              { roomId: room.id }
                            )
                          }
                          disabled={isPending}
                        >
                          {isRoomPending
                            ? "Atualizando..."
                            : room.isActive
                              ? "Desativar"
                              : "Ativar"}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
