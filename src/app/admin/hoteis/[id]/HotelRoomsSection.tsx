"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition } from "react";

import type { AuthorizedHotelRoom, HotelRoomActionState } from "./room-actions";
import {
  createHotelRoomAction,
  listHotelRoomsAction,
  toggleHotelRoomActiveAction,
  updateHotelRoomAction,
} from "./room-actions";
import {
  buildBedsValue,
  buildRoomAmenityLabels,
  parseBedsValue,
  parseRoomAmenityIds,
  ROOM_AMENITY_OPTIONS,
  ROOM_BED_OPTIONS,
} from "@/lib/room-options";
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
  hotelId: string;
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

type FileUploadFieldProps = {
  accept: string;
  auxiliaryText: string;
  fileName: string;
  id: string;
  onChange: (files: FileList | null) => void;
  title: string;
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

function BedOptionIcon({ id }: { id: string }) {
  switch (id) {
    case "bunk":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 7h14v4H5zM5 13h14v4H5zM6 19V5m12 14V5" />
        </svg>
      );
    case "sofa-bed":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 11h14v6H5zM7 11V8h10v3M6 17v2m12-2v2" />
        </svg>
      );
    case "crib":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 8h12v8H6zM8 8v8m4-8v8m4-8v8M7 16v2m10-2v2" />
        </svg>
      );
    case "child":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 11h14v5H5zM7 11V9h6v2M7 16v2m10-2v2M16.5 7.5h0" />
        </svg>
      );
    case "futon":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 13h16v4H4zM6 13v-2h12v2M5 17v1m14-1v1" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 11h16v5H4zM6 11V8h7v3M5 16v2m14-2v2" />
        </svg>
      );
  }
}

function RoomAmenityIcon({ id }: { id: string }) {
  switch (id) {
    case "air-conditioning":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h16M6 12h12M8 16h8M12 8v10M9 19l3-1 3 1" />
        </svg>
      );
    case "wifi":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 9a14.5 14.5 0 0 1 18 0M6 12.5a9.5 9.5 0 0 1 12 0M9.5 16a4.5 4.5 0 0 1 5 0M12 19h.01" />
        </svg>
      );
    case "tv":
    case "smart-tv":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16v11H4zM9 20h6M12 17v3" />
        </svg>
      );
    case "minibar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4h10v16H7zM9 8h6M12 4v16" />
        </svg>
      );
    case "safe":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 5h14v14H5zM12 12h.01M12 9v6M9 12h6" />
        </svg>
      );
    case "desk":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h16v8H4zM8 16v3M16 16v3M9 12h6" />
        </svg>
      );
    case "wardrobe":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 4h12v16H6zM12 4v16M10 12h.01M14 12h.01" />
        </svg>
      );
    case "balcony":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20h16M6 20V9h12v11M9 9V5h6v4M9 13h6" />
        </svg>
      );
    case "sea-view":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 17c1.3 0 1.9-.8 2.5-1.4.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4s1.9-.8 2.5-1.4c.6-.6 1.2-1.1 2.5-1.1s1.9.5 2.5 1.1c.6.6 1.2 1.4 2.5 1.4M6 10l3-3 3 3 3-3 3 3" />
        </svg>
      );
    case "city-view":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 20h16M6 20V9l4-2v13M14 20V5l4 2v13M9 11h.01M9 14h.01M16 10h.01M16 13h.01" />
        </svg>
      );
    case "bathtub":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12h14v3a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-3Zm3 6v2m8-2v2M9 12V9a2 2 0 0 1 4 0" />
        </svg>
      );
    case "hot-shower":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 7a6 6 0 0 1 12 0v3M18 10H9m9 0v2a4 4 0 0 1-8 0m2 4v2m4-2v2" />
        </svg>
      );
    case "hairdryer":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 12a4 4 0 1 1 0-8h6a4 4 0 0 1 0 8H9v5M14 8h5M16 6v4" />
        </svg>
      );
    case "iron":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 15h11a3 3 0 0 1 0 6H7a3 3 0 0 1-1-5.8L10 4h5l3 5" />
        </svg>
      );
    case "premium-linens":
    case "extra-pillows":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 12h16v6H4zM7 12V9a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v3" />
        </svg>
      );
    case "blackout":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 4v16M19 4v16M8 5h8v14H8zM10 8h4M10 12h4" />
        </svg>
      );
    case "soundproofing":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M11 5 6 9H3v6h3l5 4V5Zm5 5a3 3 0 0 1 0 4m2-7a7 7 0 0 1 0 10" />
        </svg>
      );
    case "daily-housekeeping":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 20h4l7-7-4-4-7 7v4Zm9-11 2-2 3 3-2 2M4 20h16" />
        </svg>
      );
    case "bath-amenities":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5h8v5H8zM6 10h12v9H6zM10 14h4" />
        </svg>
      );
    case "coffee-maker":
    case "electric-kettle":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 8h10v5a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8Zm10 1h2a2.5 2.5 0 0 1 0 5h-2M7 4v2M10 3v3M13 4v2" />
        </svg>
      );
    case "microwave":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 6h16v12H4zM8 10h5v4H8zM16 9h.01M16 12h.01M16 15h.01" />
        </svg>
      );
    case "kitchenette":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16v13H4zM8 7V4h8v3M8 12h8M7 16h.01M17 16h.01" />
        </svg>
      );
    case "living-area":
    case "sofa":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 11h14v6H5zM7 11V8h10v3M6 17v2m12-2v2" />
        </svg>
      );
    case "bedside-outlets":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 5h8v14H8zM10 10v2M14 10v2M12 15v2" />
        </svg>
      );
    case "elevator-access":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M7 4h10v16H7zM9 8l3-3 3 3M9 16l3 3 3-3" />
        </svg>
      );
    case "accessible-room":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 5h.01M10 8h4M12 9v5m0 0 4 6m-4-6-4 6m4-6H8" />
          <circle cx="12" cy="5" r="1.5" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="m5 12 4 4L19 6" />
        </svg>
      );
  }
}

function FileUploadField({
  accept,
  auxiliaryText,
  fileName,
  id,
  onChange,
  title,
}: FileUploadFieldProps) {
  return (
    <label className="admin-file-upload">
      <input
        id={id}
        className="admin-file-upload-input"
        type="file"
        accept={accept}
        aria-label={title}
        onChange={(event) => onChange(event.target.files)}
      />
      <span className="admin-file-upload-trigger">
        <span className="admin-file-upload-trigger__icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" />
          </svg>
        </span>
        <span className="admin-file-upload-trigger__content">
          <strong>{title}</strong>
          <small>{auxiliaryText}</small>
          <span className="admin-file-upload-trigger__meta" aria-live="polite">
            {fileName || "Nenhum arquivo selecionado."}
          </span>
        </span>
      </span>
    </label>
  );
}

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
      nextErrors[field as keyof RoomFormErrors] =
        field === "imageUrl" && !values.imageUrl.trim()
          ? "Envie a imagem do quarto."
          : issue.message;
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

async function uploadRoomImage(hotelId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`/api/admin/hoteis/${hotelId}/quartos/upload`, {
    method: "POST",
    body: formData,
  });

  const payload = (await response.json().catch(() => null)) as {
    ok?: boolean;
    error?: string;
    image?: {
      url: string;
    };
  } | null;

  if (!response.ok || !payload?.ok || !payload.image?.url) {
    throw new Error(payload?.error || "Nao foi possivel enviar a imagem do quarto.");
  }

  return payload.image.url;
}

function RoomFormCard({
  hotelId,
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
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageUploadFeedback, setImageUploadFeedback] = useState("");
  const [imageUploadFeedbackType, setImageUploadFeedbackType] = useState<"success" | "error">(
    "success"
  );
  const previewUrl = useMemo(
    () => (selectedImageFile ? URL.createObjectURL(selectedImageFile) : null),
    [selectedImageFile]
  );
  const imagePreviewUrl = previewUrl || values.imageUrl.trim();
  const selectedBeds = useMemo(() => parseBedsValue(values.beds), [values.beds]);
  const selectedAmenities = useMemo(
    () =>
      parseRoomAmenityIds(
        values.amenities
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
      ),
    [values.amenities]
  );

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleRoomImageUpload = async () => {
    if (!selectedImageFile) {
      setImageUploadFeedbackType("error");
      setImageUploadFeedback("Selecione um arquivo para enviar.");
      return;
    }

    setIsUploadingImage(true);
    setImageUploadFeedback("");

    try {
      const imageUrl = await uploadRoomImage(hotelId, selectedImageFile);
      onChange("imageUrl", imageUrl);
      setSelectedImageFile(null);
      setImageUploadFeedbackType("success");
      setImageUploadFeedback("Imagem do quarto enviada com sucesso.");
    } catch (error) {
      setImageUploadFeedbackType("error");
      setImageUploadFeedback(
        error instanceof Error ? error.message : "Nao foi possivel enviar a imagem do quarto."
      );
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleBedToggle = (optionId: string) => {
    const nextBeds = {
      ...selectedBeds,
      [optionId]: selectedBeds[optionId] > 0 ? 0 : 1,
    };

    onChange("beds", buildBedsValue(nextBeds));
  };

  const handleBedQuantityChange = (optionId: string, quantity: string) => {
    const normalizedQuantity = Math.max(1, Number(quantity) || 1);

    onChange(
      "beds",
      buildBedsValue({
        ...selectedBeds,
        [optionId]: normalizedQuantity,
      })
    );
  };

  const handleAmenityToggle = (amenityId: string) => {
    const nextAmenities = new Set(selectedAmenities);

    if (nextAmenities.has(amenityId)) {
      nextAmenities.delete(amenityId);
    } else {
      nextAmenities.add(amenityId);
    }

    onChange("amenities", buildRoomAmenityLabels(nextAmenities).join("\n"));
  };

  return (
    <div className={`admin-room-panel ${mode === "edit" ? "admin-room-panel--inline" : ""}`}>
      <div className="admin-room-panel-heading">
        <strong>{title}</strong>
      </div>

      {errors.general ? (
        <p className="admin-form-error admin-form-error--block">{errors.general}</p>
      ) : null}

      <div className="admin-room-form-stack">
        <section className="admin-room-form-block admin-room-form-block--split">
          <div className="admin-room-form-panel admin-room-form-panel--basic">
            <div className="admin-room-form-block-heading">
              <strong>Dados básicos</strong>
            </div>

            <div className="admin-room-basic-grid">
              <label className="admin-form-field admin-room-basic-grid__name">
                <span>Nome</span>
                <input
                  value={values.name}
                  onChange={(event) => onChange("name", event.target.value)}
                  aria-invalid={Boolean(errors.name)}
                />
                {errors.name ? <small className="admin-form-error">{errors.name}</small> : null}
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
            </div>
          </div>

          <div className="admin-room-form-panel admin-room-image-field">
            <div className="admin-room-form-block-heading">
              <strong>Imagem do quarto</strong>
            </div>

            <div className="admin-upload-panel admin-room-image-panel">
              <FileUploadField
                id={`${mode}-room-image-upload`}
                accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
                title="Selecionar imagem do quarto"
                auxiliaryText="PNG, JPG ou WebP até o limite permitido."
                fileName={selectedImageFile?.name || ""}
                onChange={(files) => {
                  setSelectedImageFile(files?.[0] ?? null);
                  setImageUploadFeedback("");
                }}
              />

              {imagePreviewUrl ? (
                <div className="admin-room-image-preview">
                  <Image
                    src={imagePreviewUrl}
                    alt={values.name ? `Imagem de ${values.name}` : "Imagem do quarto"}
                    fill
                    sizes="(max-width: 768px) 100vw, 420px"
                    unoptimized
                  />
                </div>
              ) : (
                <div className="admin-room-image-placeholder">
                  A imagem do quarto aparecerá aqui após o envio.
                </div>
              )}

              {imageUploadFeedback ? (
                <p
                  className={`admin-room-upload-feedback ${imageUploadFeedbackType === "success" ? "is-success" : "is-error"}`}
                  role={imageUploadFeedbackType === "error" ? "alert" : "status"}
                >
                  {imageUploadFeedback}
                </p>
              ) : null}

              {errors.imageUrl ? (
                <small className="admin-form-error">{errors.imageUrl}</small>
              ) : null}

              <div className="admin-room-image-upload-actions">
                <button
                  type="button"
                  className="card-cta-button admin-edit-button"
                  onClick={handleRoomImageUpload}
                  disabled={!selectedImageFile || isUploadingImage}
                >
                  {isUploadingImage ? "Enviando imagem..." : "Enviar imagem"}
                </button>
              </div>
            </div>
          </div>
        </section>

        <section className="admin-room-form-block">
          <div className="admin-room-form-block-heading">
            <strong>Descrição</strong>
          </div>

          <label className="admin-form-field admin-room-description-field">
            <span>Descrição</span>
            <textarea
              rows={5}
              value={values.description}
              onChange={(event) => onChange("description", event.target.value)}
              aria-invalid={Boolean(errors.description)}
            />
            {errors.description ? (
              <small className="admin-form-error">{errors.description}</small>
            ) : null}
          </label>
        </section>

        <section className="admin-room-form-block">
          <div className="admin-room-form-block-heading">
            <strong>Camas</strong>
          </div>

          <div className="admin-form-field">
            <div className="admin-bed-options" role="group" aria-label="Tipos de cama">
              {ROOM_BED_OPTIONS.map((option) => {
                const quantity = selectedBeds[option.id] ?? 0;
                const isSelected = quantity > 0;

                return (
                  <div
                    key={option.id}
                    className={`admin-bed-option ${isSelected ? "is-selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="admin-bed-option__button"
                      aria-pressed={isSelected}
                      onClick={() => handleBedToggle(option.id)}
                    >
                      <span className="admin-bed-option__icon">
                        <BedOptionIcon id={option.id} />
                      </span>
                      <span className="admin-bed-option__label">{option.label}</span>
                    </button>

                    {isSelected ? (
                      <label className="admin-bed-option__quantity">
                        <span>Quantidade</span>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={quantity}
                          onChange={(event) =>
                            handleBedQuantityChange(option.id, event.target.value)
                          }
                          aria-label={`Quantidade de ${option.label}`}
                        />
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <small>Selecione os tipos de cama disponíveis no quarto.</small>
            {errors.beds ? <small className="admin-form-error">{errors.beds}</small> : null}
          </div>
        </section>

        <section className="admin-room-form-block">
          <div className="admin-room-form-block-heading">
            <strong>Comodidades do quarto</strong>
          </div>

          <div className="admin-form-field">
            <div className="admin-amenities-grid admin-room-amenities-grid">
              {ROOM_AMENITY_OPTIONS.map((option) => {
                const isSelected = selectedAmenities.has(option.id);

                return (
                  <label key={option.id} className="admin-amenity-card">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleAmenityToggle(option.id)}
                      aria-label={option.label}
                    />
                    <span className="admin-amenity-card__icon" aria-hidden="true">
                      <RoomAmenityIcon id={option.id} />
                    </span>
                    <span className="admin-amenity-card__content">
                      <strong>{option.label}</strong>
                      <small>Comodidade do quarto</small>
                    </span>
                    <span className="admin-amenity-card__check" aria-hidden="true">
                      <svg viewBox="0 0 24 24">
                        <path d="m6 12 4 4 8-8" />
                      </svg>
                    </span>
                  </label>
                );
              })}
            </div>
            <small>Selecione as comodidades disponíveis dentro do quarto.</small>
            {errors.amenities ? (
              <small className="admin-form-error">{errors.amenities}</small>
            ) : null}
          </div>
        </section>
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
      throw new Error(result.message || "Nao foi possivel atualizar a lista de quartos.");
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
          throw new Error(result.message || "Nao foi possivel concluir a operacao.");
        }

        await refreshRooms();
        options?.onSuccess?.();
        setFeedbackType("success");
        setFeedback(result.message);
      } catch (error) {
        setFeedbackType("error");
        setFeedback(
          error instanceof Error ? error.message : "Nao foi possivel concluir a operacao."
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
          hotelId={hotelId}
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
                      hotelId={hotelId}
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
