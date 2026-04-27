"use client";

import Image from "next/image";
import { type FormEvent, useActionState, useEffect, useMemo, useState } from "react";

import {
  findAmenityOptionByLabel,
  HOTEL_AMENITY_OPTIONS,
  HotelAmenityIcon,
} from "@/lib/hotel-amenities";

import type { HotelEditorState } from "./actions";

const initialState: HotelEditorState = {
  status: "idle",
  message: "",
};

type ImageItem = {
  id: string;
  url: string;
  alt: string;
  preview?: boolean;
};

type PolicyItem = {
  id: string;
  title: string;
  description: string;
};

type PolicyErrors = Record<string, Partial<Record<"title" | "description", string>>>;

type FileUploadFieldProps = {
  accept: string;
  auxiliaryText: string;
  fileNames: string[];
  id: string;
  multiple?: boolean;
  onChange: (files: FileList | null) => void;
  title: string;
};

type HotelEditorFormProps = {
  action: (state: HotelEditorState, formData: FormData) => Promise<HotelEditorState>;
  hotel: {
    id: string;
    name: string;
    slug: string;
    shortDescription: string;
    fullDescription: string;
    city: string;
    state: string;
    address: string;
    phone: string;
    email: string;
    whatsapp: string;
    coverImageUrl: string;
    checkInTime: string;
    checkOutTime: string;
    isPublished: boolean;
    images: Array<{
      id: string;
      url: string;
      alt: string;
    }>;
    amenities: Array<{
      id: string;
      label: string;
    }>;
    policies: Array<{
      id: string;
      title: string;
      description: string;
    }>;
  };
};

function FileUploadField({
  accept,
  auxiliaryText,
  fileNames,
  id,
  multiple = false,
  onChange,
  title,
}: FileUploadFieldProps) {
  const hasFiles = fileNames.length > 0;

  return (
    <label className="admin-file-upload">
      <input
        id={id}
        className="admin-file-upload-input"
        type="file"
        accept={accept}
        multiple={multiple}
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
            {hasFiles
              ? fileNames.length === 1
                ? fileNames[0]
                : `${fileNames.length} arquivos selecionados`
              : "Nenhum arquivo selecionado."}
          </span>
        </span>
      </span>
      {hasFiles && fileNames.length > 1 ? (
        <span className="admin-file-upload-list" aria-live="polite">
          {fileNames.join(", ")}
        </span>
      ) : null}
    </label>
  );
}

export function HotelEditorForm({ action, hotel }: HotelEditorFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [coverImageUrl, setCoverImageUrl] = useState(hotel.coverImageUrl);
  const [galleryImages, setGalleryImages] = useState<ImageItem[]>(hotel.images);
  const [coverUploadFile, setCoverUploadFile] = useState<File | null>(null);
  const [galleryUploadFiles, setGalleryUploadFiles] = useState<File[]>([]);
  const [uploadAlt, setUploadAlt] = useState("");
  const [uploadFeedback, setUploadFeedback] = useState("");
  const [uploadFeedbackType, setUploadFeedbackType] = useState<"success" | "error">("success");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingGallery, setIsUploadingGallery] = useState(false);
  const [removingImageId, setRemovingImageId] = useState<string | null>(null);
  const [amenityFormError, setAmenityFormError] = useState("");
  const [policies, setPolicies] = useState<PolicyItem[]>(
    hotel.policies.map((policy) => ({
      id: policy.id,
      title: policy.title,
      description: policy.description,
    }))
  );
  const [policyErrors, setPolicyErrors] = useState<PolicyErrors>({});
  const [policyFormError, setPolicyFormError] = useState("");

  const galleryValue = useMemo(
    () => galleryImages.map((image) => `${image.url} | ${image.alt}`).join("\n"),
    [galleryImages]
  );

  const selectedAmenityIds = useMemo(
    () =>
      new Set(
        hotel.amenities
          .map((amenity) => findAmenityOptionByLabel(amenity.label)?.id)
          .filter((value): value is string => Boolean(value))
      ),
    [hotel.amenities]
  );
  const legacyAmenities = useMemo(
    () => hotel.amenities.filter((amenity) => !findAmenityOptionByLabel(amenity.label)),
    [hotel.amenities]
  );

  const coverPreviewUrl = useMemo(
    () => (coverUploadFile ? URL.createObjectURL(coverUploadFile) : null),
    [coverUploadFile]
  );
  const galleryPreviewUrls = useMemo(
    () =>
      galleryUploadFiles.map((file, index) => ({
        id: `preview-${index}-${file.name}`,
        url: URL.createObjectURL(file),
        alt: file.name,
      })),
    [galleryUploadFiles]
  );

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }

      galleryPreviewUrls.forEach((image) => {
        URL.revokeObjectURL(image.url);
      });
    };
  }, [coverPreviewUrl, galleryPreviewUrls]);

  async function handleCoverUpload() {
    if (!coverUploadFile) {
      setUploadFeedbackType("error");
      setUploadFeedback("Selecione a imagem de capa.");
      return;
    }

    setIsUploadingCover(true);
    setUploadFeedback("");

    try {
      const payload = new FormData();
      payload.set("file", coverUploadFile);
      payload.set("alt", uploadAlt);
      payload.set("setAsCover", "true");

      const response = await fetch(`/api/admin/hoteis/${hotel.id}/upload`, {
        method: "POST",
        body: payload,
      });

      const result = (await response.json()) as {
        error?: string;
        images?: Array<{ id: string; url: string; alt: string; setAsCover?: boolean }>;
      };

      if (!response.ok || !result.images?.length) {
        throw new Error(result.error || "Não foi possível concluir o upload da capa.");
      }

      const uploadedImage = result.images[0];
      setCoverImageUrl(uploadedImage.url);
      setGalleryImages((current) => [
        ...current.filter((image) => image.url !== uploadedImage.url),
        uploadedImage,
      ]);
      setCoverUploadFile(null);
      setUploadAlt("");
      setUploadFeedbackType("success");
      setUploadFeedback("Imagem de capa enviada com sucesso.");
    } catch (error) {
      setUploadFeedbackType("error");
      setUploadFeedback(
        error instanceof Error ? error.message : "Não foi possível concluir o upload da capa."
      );
    } finally {
      setIsUploadingCover(false);
    }
  }

  async function handleGalleryUpload() {
    if (galleryUploadFiles.length === 0) {
      setUploadFeedbackType("error");
      setUploadFeedback("Selecione ao menos uma imagem para a galeria.");
      return;
    }

    setIsUploadingGallery(true);
    setUploadFeedback("");

    try {
      const payload = new FormData();
      galleryUploadFiles.forEach((file) => payload.append("files", file));
      payload.set("alt", uploadAlt);

      const response = await fetch(`/api/admin/hoteis/${hotel.id}/upload`, {
        method: "POST",
        body: payload,
      });

      const result = (await response.json()) as {
        error?: string;
        images?: Array<{ id: string; url: string; alt: string }>;
      };

      if (!response.ok || !result.images?.length) {
        throw new Error(result.error || "Não foi possível concluir o upload da galeria.");
      }

      const uploadedImages = result.images ?? [];

      setGalleryImages((current) => [...current, ...uploadedImages]);
      setGalleryUploadFiles([]);
      setUploadAlt("");
      setUploadFeedbackType("success");
      setUploadFeedback("Imagens da galeria enviadas com sucesso.");
    } catch (error) {
      setUploadFeedbackType("error");
      setUploadFeedback(
        error instanceof Error ? error.message : "Não foi possível concluir o upload da galeria."
      );
    } finally {
      setIsUploadingGallery(false);
    }
  }

  async function handleRemoveImage(image: ImageItem) {
    if (!image.id || image.preview) {
      return;
    }

    if (!window.confirm("Deseja remover esta imagem?")) {
      return;
    }

    setRemovingImageId(image.id);
    setUploadFeedback("");

    try {
      const response = await fetch(`/api/admin/hoteis/${hotel.id}/images/${image.id}`, {
        method: "DELETE",
      });

      const result = (await response.json()) as {
        error?: string;
        removedImageId?: string;
        nextCoverImageUrl?: string;
      };

      if (!response.ok || !result.removedImageId) {
        throw new Error(result.error || "Não foi possível remover a imagem.");
      }

      setGalleryImages((current) => current.filter((item) => item.id !== result.removedImageId));
      if (result.nextCoverImageUrl) {
        setCoverImageUrl(result.nextCoverImageUrl);
      }

      setUploadFeedbackType("success");
      setUploadFeedback("Imagem removida com sucesso.");
    } catch (error) {
      setUploadFeedbackType("error");
      setUploadFeedback(
        error instanceof Error ? error.message : "Não foi possível remover a imagem."
      );
    } finally {
      setRemovingImageId(null);
    }
  }

  function updatePolicy(id: string, field: "title" | "description", value: string) {
    setPolicies((current) =>
      current.map((policy) => (policy.id === id ? { ...policy, [field]: value } : policy))
    );
    setPolicyErrors((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: undefined,
      },
    }));
    setPolicyFormError("");
  }

  function addPolicy() {
    setPolicies((current) => [
      ...current,
      {
        id: `new-policy-${Date.now()}`,
        title: "",
        description: "",
      },
    ]);
    setPolicyFormError("");
  }

  function removePolicy(id: string) {
    setPolicies((current) => current.filter((policy) => policy.id !== id));
    setPolicyErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[id];
      return nextErrors;
    });
  }

  function movePolicy(id: string, direction: -1 | 1) {
    setPolicies((current) => {
      const index = current.findIndex((policy) => policy.id === id);
      const targetIndex = index + direction;

      if (index < 0 || targetIndex < 0 || targetIndex >= current.length) {
        return current;
      }

      const nextPolicies = [...current];
      const [policy] = nextPolicies.splice(index, 1);
      nextPolicies.splice(targetIndex, 0, policy);
      return nextPolicies;
    });
  }

  function validatePolicies() {
    const nextErrors: PolicyErrors = {};

    policies.forEach((policy) => {
      const itemErrors: Partial<Record<"title" | "description", string>> = {};
      const title = policy.title.trim();
      const description = policy.description.trim();

      if (title.length < 2) {
        itemErrors.title = "Informe a política com pelo menos 2 caracteres.";
      } else if (title.length > 80) {
        itemErrors.title = "Use no máximo 80 caracteres.";
      }

      if (description.length < 3) {
        itemErrors.description = "Informe a descrição com pelo menos 3 caracteres.";
      } else if (description.length > 600) {
        itemErrors.description = "Use no máximo 600 caracteres.";
      }

      if (Object.keys(itemErrors).length > 0) {
        nextErrors[policy.id] = itemErrors;
      }
    });

    setPolicyErrors(nextErrors);

    if (policies.length === 0) {
      setPolicyFormError("Adicione pelo menos uma política do hotel.");
      return false;
    }

    if (Object.keys(nextErrors).length > 0) {
      setPolicyFormError("Revise os campos destacados antes de salvar.");
      return false;
    }

    setPolicyFormError("");
    return true;
  }

  function serializePolicyValue(policy: PolicyItem) {
    const normalizedTitle = policy.title.replaceAll("|", " - ").trim();
    const normalizedDescription = policy.description
      .replaceAll("|", " - ")
      .replace(/\r?\n/g, " ")
      .trim();

    return `${normalizedTitle} | ${normalizedDescription}`;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const hasAmenities = formData.getAll("amenities").length > 0;
    const hasValidPolicies = validatePolicies();

    setAmenityFormError(hasAmenities ? "" : "Selecione pelo menos uma comodidade.");

    if (!hasAmenities || !hasValidPolicies) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} className="admin-editor-form" onSubmit={handleSubmit}>
      <div className="admin-editor-banner">
        <strong>Publicação imediata</strong>
        <p>Toda alteração salva aqui impacta imediatamente o perfil público do hotel.</p>
      </div>

      {state.message ? (
        <p
          className={`admin-editor-feedback ${state.status === "success" ? "is-success" : "is-error"}`}
        >
          {state.message}
        </p>
      ) : null}

      {uploadFeedback ? (
        <p
          className={`admin-editor-feedback ${uploadFeedbackType === "success" ? "is-success" : "is-error"}`}
        >
          {uploadFeedback}
        </p>
      ) : null}

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Dados principais</h2>
        </div>
        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>Nome</span>
            <input name="name" defaultValue={hotel.name} required />
          </label>
          <label className="admin-form-field">
            <span>Slug</span>
            <input name="slug" defaultValue={hotel.slug} required />
          </label>
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Localização</h2>
        </div>
        <div className="admin-form-grid admin-form-grid--three">
          <label className="admin-form-field">
            <span>Cidade</span>
            <input name="city" defaultValue={hotel.city} required />
          </label>
          <label className="admin-form-field">
            <span>Estado</span>
            <input name="state" defaultValue={hotel.state} required maxLength={2} />
          </label>
          <label className="admin-form-field admin-form-field--full">
            <span>Endereço</span>
            <input name="address" defaultValue={hotel.address} required />
          </label>
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Contato</h2>
        </div>
        <div className="admin-form-grid admin-form-grid--three">
          <label className="admin-form-field">
            <span>Telefone</span>
            <input name="phone" defaultValue={hotel.phone} required />
          </label>
          <label className="admin-form-field">
            <span>E-mail</span>
            <input type="email" name="email" defaultValue={hotel.email} required />
          </label>
          <label className="admin-form-field">
            <span>WhatsApp</span>
            <input name="whatsapp" defaultValue={hotel.whatsapp} required />
          </label>
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Descrições</h2>
        </div>
        <div className="admin-form-grid">
          <label className="admin-form-field">
            <span>Descrição curta</span>
            <textarea
              name="shortDescription"
              defaultValue={hotel.shortDescription}
              rows={3}
              required
            />
          </label>
          <label className="admin-form-field">
            <span>Descrição completa</span>
            <textarea
              name="fullDescription"
              defaultValue={hotel.fullDescription}
              rows={6}
              required
            />
          </label>
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Galeria</h2>
        </div>

        <div className="admin-form-grid">
          <label className="admin-form-field">
            <span>Imagem de capa</span>
            <input
              name="coverImageUrl"
              value={coverImageUrl}
              onChange={(event) => setCoverImageUrl(event.target.value)}
              required
            />
          </label>

          <div className="admin-image-preview-card">
            <span className="admin-image-preview-label">Preview da capa</span>
            <Image
              src={coverPreviewUrl || coverImageUrl}
              alt={`Capa de ${hotel.name}`}
              className="admin-cover-preview-image"
              width={960}
              height={520}
              sizes="(max-width: 900px) 100vw, 70vw"
              unoptimized
            />
          </div>

          <div className="admin-upload-panel">
            <div className="admin-form-grid admin-form-grid--two">
              <FileUploadField
                id="cover-upload-input"
                title="Selecionar imagem de capa"
                auxiliaryText="PNG, JPG ou WebP até o limite permitido."
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                fileNames={coverUploadFile ? [coverUploadFile.name] : []}
                onChange={(files) => setCoverUploadFile(files?.[0] ?? null)}
              />

              <label className="admin-form-field">
                <span>Texto alternativo</span>
                <input value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} />
              </label>
            </div>

            <div className="admin-upload-actions">
              <button
                type="button"
                className="card-cta-button admin-edit-button"
                onClick={handleCoverUpload}
                disabled={isUploadingCover || !coverUploadFile}
              >
                {isUploadingCover ? "Enviando capa..." : "Enviar capa"}
              </button>
            </div>
          </div>

          <div className="admin-upload-panel">
            <div className="admin-form-grid admin-form-grid--two">
              <FileUploadField
                id="gallery-upload-input"
                title="Selecionar imagens da galeria"
                auxiliaryText="Você pode selecionar múltiplas imagens."
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                multiple
                fileNames={galleryUploadFiles.map((file) => file.name)}
                onChange={(files) => setGalleryUploadFiles(Array.from(files ?? []))}
              />

              <label className="admin-form-field">
                <span>Texto alternativo base</span>
                <input value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} />
              </label>
            </div>

            {galleryPreviewUrls.length > 0 ? (
              <div className="admin-preview-grid">
                {galleryPreviewUrls.map((image) => (
                  <figure key={image.id} className="admin-preview-item">
                    <Image
                      src={image.url}
                      alt={image.alt}
                      width={360}
                      height={180}
                      sizes="(max-width: 900px) 50vw, 240px"
                      unoptimized
                    />
                  </figure>
                ))}
              </div>
            ) : null}

            <div className="admin-upload-actions">
              <button
                type="button"
                className="card-cta-button admin-edit-button"
                onClick={handleGalleryUpload}
                disabled={isUploadingGallery || galleryUploadFiles.length === 0}
              >
                {isUploadingGallery ? "Enviando galeria..." : "Enviar galeria"}
              </button>
            </div>
          </div>

          <div className="admin-managed-gallery">
            <span className="admin-image-preview-label">Imagens atuais</span>
            {galleryImages.length === 0 ? (
              <div className="hotel-empty-state admin-history-empty">
                <strong>Nenhuma imagem cadastrada.</strong>
                <p>Envie imagens para exibir na galeria pública do hotel.</p>
              </div>
            ) : (
              <div className="admin-preview-grid">
                {galleryImages.map((image) => (
                  <article key={image.id} className="admin-preview-card">
                    <Image
                      src={image.url}
                      alt={image.alt}
                      width={360}
                      height={180}
                      sizes="(max-width: 900px) 50vw, 240px"
                      unoptimized
                    />
                    <div className="admin-preview-card-body">
                      <strong>{image.url === coverImageUrl ? "Capa atual" : "Galeria"}</strong>
                      <p>{image.alt}</p>
                      <button
                        type="button"
                        className="admin-remove-image-button"
                        onClick={() => handleRemoveImage(image)}
                        disabled={removingImageId === image.id}
                      >
                        {removingImageId === image.id ? "Removendo..." : "Remover"}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <label className="admin-form-field">
            <span>Galeria</span>
            <textarea
              name="gallery"
              value={galleryValue}
              onChange={() => undefined}
              rows={6}
              readOnly
            />
            <small>Atualizada automaticamente pelos uploads e remoções.</small>
          </label>
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Comodidades</h2>
        </div>
        <div className="admin-form-field">
          <span>Selecione as comodidades</span>
          <div className="admin-amenities-grid" role="group" aria-label="Comodidades do hotel">
            {HOTEL_AMENITY_OPTIONS.map((amenity) => (
              <label key={amenity.id} className="admin-amenity-card">
                <input
                  type="checkbox"
                  name="amenities"
                  value={amenity.label}
                  defaultChecked={selectedAmenityIds.has(amenity.id)}
                  onChange={() => setAmenityFormError("")}
                />
                <span className="admin-amenity-card__icon">
                  <HotelAmenityIcon amenityId={amenity.id} />
                </span>
                <span className="admin-amenity-card__content">
                  <strong>{amenity.label}</strong>
                  <small>{amenity.id}</small>
                </span>
                <span className="admin-amenity-card__check" aria-hidden="true">
                  <svg viewBox="0 0 24 24">
                    <path d="m6 12 4 4 8-8" />
                  </svg>
                </span>
              </label>
            ))}
          </div>
          {amenityFormError ? <small className="admin-form-error">{amenityFormError}</small> : null}
          {legacyAmenities.length ? (
            <div className="admin-legacy-amenities">
              <small>
                Comodidades legadas preservadas automaticamente até revisão:{" "}
                {legacyAmenities.map((amenity) => amenity.label).join(", ")}.
              </small>
              {legacyAmenities.map((amenity) => (
                <input key={amenity.id} type="hidden" name="amenities" value={amenity.label} />
              ))}
            </div>
          ) : (
            <small>Seleção visual com 30 comodidades padronizadas.</small>
          )}
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Políticas</h2>
        </div>
        <div className="admin-policy-editor">
          <div className="admin-policy-editor__intro">
            <p>Cadastre regras claras para orientar o hóspede antes da reserva.</p>
            <button type="button" className="admin-secondary-button" onClick={addPolicy}>
              Adicionar política
            </button>
          </div>

          {policyFormError ? (
            <p className="admin-form-error admin-form-error--block">{policyFormError}</p>
          ) : null}

          {policies.length === 0 ? (
            <div className="hotel-empty-state admin-history-empty">
              <strong>Nenhuma política cadastrada ainda.</strong>
              <p>Adicione a primeira política do hotel.</p>
            </div>
          ) : (
            <div className="admin-policy-list-editor">
              {policies.map((policy, index) => (
                <article key={policy.id} className="admin-policy-editor-item">
                  <div className="admin-policy-editor-item__top">
                    <strong>Política {index + 1}</strong>
                    <div className="admin-policy-editor-item__actions">
                      <button
                        type="button"
                        className="admin-secondary-button"
                        onClick={() => movePolicy(policy.id, -1)}
                        disabled={index === 0}
                      >
                        Subir
                      </button>
                      <button
                        type="button"
                        className="admin-secondary-button"
                        onClick={() => movePolicy(policy.id, 1)}
                        disabled={index === policies.length - 1}
                      >
                        Descer
                      </button>
                      <button
                        type="button"
                        className="admin-remove-image-button"
                        onClick={() => removePolicy(policy.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <div className="admin-form-grid admin-form-grid--two">
                    <label className="admin-form-field">
                      <span>Política</span>
                      <input
                        value={policy.title}
                        maxLength={80}
                        onChange={(event) => updatePolicy(policy.id, "title", event.target.value)}
                        aria-invalid={Boolean(policyErrors[policy.id]?.title)}
                      />
                      {policyErrors[policy.id]?.title ? (
                        <small className="admin-form-error">{policyErrors[policy.id]?.title}</small>
                      ) : (
                        <small>Ex.: Cancelamento, check-in, pets.</small>
                      )}
                    </label>

                    <label className="admin-form-field">
                      <span>Descrição</span>
                      <textarea
                        value={policy.description}
                        maxLength={600}
                        rows={3}
                        onChange={(event) =>
                          updatePolicy(policy.id, "description", event.target.value)
                        }
                        aria-invalid={Boolean(policyErrors[policy.id]?.description)}
                      />
                      {policyErrors[policy.id]?.description ? (
                        <small className="admin-form-error">
                          {policyErrors[policy.id]?.description}
                        </small>
                      ) : (
                        <small>Explique a regra de forma curta e objetiva.</small>
                      )}
                    </label>
                  </div>

                  <input type="hidden" name="policies" value={serializePolicyValue(policy)} />
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Horários</h2>
        </div>
        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>Check-in</span>
            <input name="checkInTime" defaultValue={hotel.checkInTime} required />
          </label>
          <label className="admin-form-field">
            <span>Check-out</span>
            <input name="checkOutTime" defaultValue={hotel.checkOutTime} required />
          </label>
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Visibilidade e publicação</h2>
        </div>
        <label className="admin-toggle-field">
          <input type="checkbox" name="isPublished" defaultChecked={hotel.isPublished} />
          <span>Hotel publicado e visível no site</span>
        </label>
      </section>

      <div className="admin-editor-actions">
        <button type="submit" className="card-cta-button" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
