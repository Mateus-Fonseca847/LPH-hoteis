"use client";

import { useActionState, useEffect, useMemo, useState } from "react";

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

  const galleryValue = useMemo(
    () => galleryImages.map((image) => `${image.url} | ${image.alt}`).join("\n"),
    [galleryImages]
  );

  const amenitiesValue = useMemo(
    () => hotel.amenities.map((amenity) => amenity.label).join("\n"),
    [hotel.amenities]
  );

  const policiesValue = useMemo(
    () => hotel.policies.map((policy) => `${policy.title} | ${policy.description}`).join("\n"),
    [hotel.policies]
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

  return (
    <form action={formAction} className="admin-editor-form">
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
            <img
              src={coverPreviewUrl || coverImageUrl}
              alt={`Capa de ${hotel.name}`}
              className="admin-cover-preview-image"
            />
          </div>

          <div className="admin-upload-panel">
            <div className="admin-form-grid admin-form-grid--two">
              <label className="admin-form-field">
                <span>Upload de capa</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={(event) => setCoverUploadFile(event.target.files?.[0] ?? null)}
                />
              </label>

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
                disabled={isUploadingCover}
              >
                {isUploadingCover ? "Enviando capa..." : "Enviar capa"}
              </button>
            </div>
          </div>

          <div className="admin-upload-panel">
            <div className="admin-form-grid admin-form-grid--two">
              <label className="admin-form-field">
                <span>Upload da galeria</span>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={(event) => setGalleryUploadFiles(Array.from(event.target.files ?? []))}
                />
              </label>

              <label className="admin-form-field">
                <span>Texto alternativo base</span>
                <input value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} />
              </label>
            </div>

            {galleryPreviewUrls.length > 0 ? (
              <div className="admin-preview-grid">
                {galleryPreviewUrls.map((image) => (
                  <figure key={image.id} className="admin-preview-item">
                    <img src={image.url} alt={image.alt} />
                  </figure>
                ))}
              </div>
            ) : null}

            <div className="admin-upload-actions">
              <button
                type="button"
                className="card-cta-button admin-edit-button"
                onClick={handleGalleryUpload}
                disabled={isUploadingGallery}
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
                    <img src={image.url} alt={image.alt} />
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
        <label className="admin-form-field">
          <span>Lista de comodidades</span>
          <textarea name="amenities" defaultValue={amenitiesValue} rows={6} />
          <small>Uma comodidade por linha.</small>
        </label>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Políticas</h2>
        </div>
        <label className="admin-form-field">
          <span>Lista de políticas</span>
          <textarea name="policies" defaultValue={policiesValue} rows={6} />
          <small>Uma política por linha no formato: Título | descrição.</small>
        </label>
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
