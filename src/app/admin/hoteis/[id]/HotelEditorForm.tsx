"use client";

import { useActionState, useMemo, useState } from "react";

import type { HotelEditorState } from "./actions";

const initialState: HotelEditorState = {
  status: "idle",
  message: "",
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
  const [galleryValue, setGalleryValue] = useState(
    hotel.images.map((image) => `${image.url} | ${image.alt}`).join("\n")
  );
  const [uploadAlt, setUploadAlt] = useState("");
  const [setAsCover, setSetAsCover] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadFeedback, setUploadFeedback] = useState("");
  const [uploadFeedbackType, setUploadFeedbackType] = useState<"success" | "error">("success");
  const [isUploading, setIsUploading] = useState(false);

  const amenitiesValue = useMemo(
    () => hotel.amenities.map((amenity) => amenity.label).join("\n"),
    [hotel.amenities]
  );

  const policiesValue = useMemo(
    () => hotel.policies.map((policy) => `${policy.title} | ${policy.description}`).join("\n"),
    [hotel.policies]
  );

  async function handleImageUpload() {
    if (!uploadFile) {
      setUploadFeedbackType("error");
      setUploadFeedback("Selecione uma imagem antes de enviar.");
      return;
    }

    setIsUploading(true);
    setUploadFeedback("");

    try {
      const payload = new FormData();
      payload.set("file", uploadFile);
      payload.set("alt", uploadAlt);
      payload.set("setAsCover", String(setAsCover));

      const response = await fetch(`/api/admin/hoteis/${hotel.id}/upload`, {
        method: "POST",
        body: payload,
      });

      const result = (await response.json()) as {
        ok?: boolean;
        error?: string;
        image?: {
          url: string;
          alt: string;
          setAsCover?: boolean;
        };
      };

      if (!response.ok || !result.image) {
        throw new Error(result.error || "Não foi possível concluir o upload.");
      }

      setGalleryValue((current) =>
        current.trim()
          ? `${current}\n${result.image?.url} | ${result.image?.alt}`
          : `${result.image?.url} | ${result.image?.alt}`
      );

      if (result.image.setAsCover) {
        setCoverImageUrl(result.image.url);
      }

      setUploadFeedbackType("success");
      setUploadFeedback("Imagem enviada com sucesso.");
      setUploadAlt("");
      setSetAsCover(false);
      setUploadFile(null);
    } catch (error) {
      setUploadFeedbackType("error");
      setUploadFeedback(error instanceof Error ? error.message : "Não foi possível concluir o upload.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <form action={formAction} className="admin-editor-form">
      <div className="admin-editor-banner">
        <strong>Publicação imediata</strong>
        <p>Toda alteração salva aqui impacta imediatamente o perfil público do hotel.</p>
      </div>

      {state.message ? (
        <p className={`admin-editor-feedback ${state.status === "success" ? "is-success" : "is-error"}`}>
          {state.message}
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
            <textarea name="shortDescription" defaultValue={hotel.shortDescription} rows={3} required />
          </label>
          <label className="admin-form-field">
            <span>Descrição completa</span>
            <textarea name="fullDescription" defaultValue={hotel.fullDescription} rows={6} required />
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

          <div className="admin-upload-panel">
            <div className="admin-form-grid admin-form-grid--two">
              <label className="admin-form-field">
                <span>Arquivo de imagem</span>
                <input
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                  onChange={(event) => setUploadFile(event.target.files?.[0] ?? null)}
                />
              </label>

              <label className="admin-form-field">
                <span>Texto alternativo</span>
                <input value={uploadAlt} onChange={(event) => setUploadAlt(event.target.value)} />
              </label>
            </div>

            <label className="admin-toggle-field">
              <input type="checkbox" checked={setAsCover} onChange={(event) => setSetAsCover(event.target.checked)} />
              <span>Definir como capa ao enviar</span>
            </label>

            <div className="admin-upload-actions">
              <button
                type="button"
                className="card-cta-button admin-edit-button"
                onClick={handleImageUpload}
                disabled={isUploading}
              >
                {isUploading ? "Enviando..." : "Enviar imagem"}
              </button>
            </div>

            {uploadFeedback ? (
              <p className={`admin-editor-feedback ${uploadFeedbackType === "success" ? "is-success" : "is-error"}`}>
                {uploadFeedback}
              </p>
            ) : null}
          </div>

          <label className="admin-form-field">
            <span>Galeria</span>
            <textarea
              name="gallery"
              value={galleryValue}
              onChange={(event) => setGalleryValue(event.target.value)}
              rows={6}
              placeholder="https://... | Alt da imagem"
            />
            <small>Uma imagem por linha: URL | texto alternativo.</small>
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
