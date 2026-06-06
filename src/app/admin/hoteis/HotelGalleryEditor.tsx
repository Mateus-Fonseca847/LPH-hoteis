"use client";

import { ImageWithFallback } from "@/components/ImageWithFallback";

import { HotelFileUploadField } from "./HotelFileUploadField";

type ImageItem = {
  id: string;
  url: string;
  alt: string;
  preview?: boolean;
};

type HotelGalleryEditorProps = {
  mode: "create" | "edit";
  hotelName: string;
  coverImageUrl: string;
  coverPreviewUrl: string | null;
  galleryImages: ImageItem[];
  galleryPreviewUrls?: Array<{
    id: string;
    url: string;
    alt: string;
  }>;
  coverUploadFileName?: string;
  galleryUploadFileNames?: string[];
  uploadAlt: string;
  uploadFeedback?: string;
  removingImageId?: string | null;
  isUploadingCover?: boolean;
  isUploadingGallery?: boolean;
  onCoverImageUrlChange?: (value: string) => void;
  onCoverFileChange: (files: FileList | null) => void;
  onGalleryFilesChange?: (files: FileList | null) => void;
  onUploadAltChange: (value: string) => void;
  onCoverUpload?: () => void;
  onGalleryUpload?: () => void;
  onRemoveImage?: (image: ImageItem) => void;
};

export function HotelGalleryEditor({
  mode,
  hotelName,
  coverImageUrl,
  coverPreviewUrl,
  galleryImages,
  galleryPreviewUrls = [],
  coverUploadFileName = "",
  galleryUploadFileNames = [],
  uploadAlt,
  removingImageId = null,
  isUploadingCover = false,
  isUploadingGallery = false,
  onCoverImageUrlChange,
  onCoverFileChange,
  onGalleryFilesChange,
  onUploadAltChange,
  onCoverUpload,
  onGalleryUpload,
  onRemoveImage,
}: HotelGalleryEditorProps) {
  const isCreateMode = mode === "create";
  const resolvedPreviewSource = coverPreviewUrl || coverImageUrl;

  return (
    <div className="admin-form-grid">
      {onCoverImageUrlChange ? (
        <label className="admin-form-field">
          <span>{isCreateMode ? "URL da imagem de capa" : "Imagem de capa"}</span>
          <input
            name="coverImageUrl"
            value={coverImageUrl}
            onChange={(event) => onCoverImageUrlChange?.(event.target.value)}
            required={!isCreateMode}
            placeholder={isCreateMode ? "https://..." : undefined}
          />
          {isCreateMode ? (
            <small>Use uma URL se o storage de upload ainda não estiver configurado.</small>
          ) : null}
        </label>
      ) : null}

      {resolvedPreviewSource ? (
        <div className="admin-image-preview-card">
          <span className="admin-image-preview-label">Preview da capa</span>
          {coverPreviewUrl ? (
            <div
              className="admin-create-hotel-cover-preview"
              role="img"
              aria-label="Prévia da imagem de capa selecionada"
              style={{ backgroundImage: `url(${coverPreviewUrl})` }}
            />
          ) : (
            <ImageWithFallback
              src={resolvedPreviewSource}
              alt={`Capa de ${hotelName}`}
              fallbackLabel={`Imagem indisponível de ${hotelName}`}
              className="admin-cover-preview-image"
              width={960}
              height={520}
              sizes="(max-width: 900px) 100vw, 70vw"
              unoptimized
            />
          )}
        </div>
      ) : null}

      <div className="admin-upload-panel">
        <div className="admin-form-grid admin-form-grid--two">
          <HotelFileUploadField
            id={isCreateMode ? "cover-create-upload-input" : "cover-upload-input"}
            inputName={isCreateMode ? "coverImage" : undefined}
            required={false}
            title="Selecionar imagem de capa"
            auxiliaryText="PNG, JPG ou WebP até o limite permitido."
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            fileNames={coverUploadFileName ? [coverUploadFileName] : []}
            onChange={onCoverFileChange}
          />

          <label className="admin-form-field">
            <span>Texto alternativo</span>
            <input
              name={isCreateMode ? "coverAlt" : undefined}
              value={uploadAlt}
              onChange={(event) => onUploadAltChange(event.target.value)}
            />
          </label>
        </div>

        {!isCreateMode ? (
          <div className="admin-upload-actions">
            <button
              type="button"
              className="card-cta-button admin-edit-button"
              onClick={onCoverUpload}
              disabled={isUploadingCover || !coverUploadFileName}
            >
              {isUploadingCover ? "Enviando capa..." : "Enviar capa"}
            </button>
          </div>
        ) : null}
      </div>

      <div className="admin-upload-panel">
        <div className="admin-form-grid admin-form-grid--two">
          <HotelFileUploadField
            id={isCreateMode ? "gallery-create-upload-input" : "gallery-upload-input"}
            title="Selecionar imagens da galeria"
            auxiliaryText={
              isCreateMode
                ? "Disponível após salvar o rascunho."
                : "Você pode selecionar múltiplas imagens."
            }
            accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
            multiple
            fileNames={galleryUploadFileNames}
            onChange={onGalleryFilesChange ?? (() => undefined)}
            disabled={isCreateMode}
          />

          <label className="admin-form-field">
            <span>Texto alternativo base</span>
            <input
              value={uploadAlt}
              onChange={(event) => onUploadAltChange(event.target.value)}
              readOnly={isCreateMode}
            />
          </label>
        </div>

        {galleryPreviewUrls.length > 0 ? (
          <div className="admin-preview-grid">
            {galleryPreviewUrls.map((image) => (
              <figure key={image.id} className="admin-preview-item">
                <ImageWithFallback
                  src={image.url}
                  alt={image.alt}
                  fallbackLabel="Preview indisponível"
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
          {isCreateMode ? (
            <p className="admin-rooms-copy">
              Salve os dados básicos para liberar o upload direto de imagens da galeria.
            </p>
          ) : (
            <button
              type="button"
              className="card-cta-button admin-edit-button"
              onClick={onGalleryUpload}
              disabled={isUploadingGallery || galleryUploadFileNames.length === 0}
            >
              {isUploadingGallery ? "Enviando galeria..." : "Enviar galeria"}
            </button>
          )}
        </div>
      </div>

      <div className="admin-managed-gallery">
        <span className="admin-image-preview-label">Imagens atuais</span>
        {galleryImages.length === 0 ? (
          <div className="hotel-empty-state admin-history-empty">
            <strong>Nenhuma imagem cadastrada.</strong>
            <p>
              {isCreateMode
                ? "A primeira imagem da galeria será gerada a partir da capa após salvar o rascunho."
                : "Envie imagens para exibir na galeria pública do hotel."}
            </p>
          </div>
        ) : (
          <div className="admin-preview-grid">
            {galleryImages.map((image) => (
              <article key={image.id} className="admin-preview-card">
                <ImageWithFallback
                  src={image.url}
                  alt={image.alt}
                  fallbackLabel={`Imagem indisponível de ${hotelName}`}
                  width={360}
                  height={180}
                  sizes="(max-width: 900px) 50vw, 240px"
                  unoptimized
                />
                <div className="admin-preview-card-body">
                  <strong>{image.url === coverImageUrl ? "Capa atual" : "Galeria"}</strong>
                  <p>{image.alt}</p>
                  {!isCreateMode ? (
                    <button
                      type="button"
                      className="admin-remove-image-button"
                      onClick={() => onRemoveImage?.(image)}
                      disabled={removingImageId === image.id}
                    >
                      {removingImageId === image.id ? "Removendo..." : "Remover"}
                    </button>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {!isCreateMode ? (
        <label className="admin-form-field">
          <span>Galeria</span>
          <textarea
            name="gallery"
            value={galleryImages.map((image) => `${image.url} | ${image.alt}`).join("\n")}
            onChange={() => undefined}
            rows={6}
            readOnly
          />
          <small>Atualizada automaticamente pelos uploads e remoções.</small>
        </label>
      ) : null}
    </div>
  );
}
