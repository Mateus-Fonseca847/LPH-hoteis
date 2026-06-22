"use client";

import { ImageWithFallback } from "@/components/ImageWithFallback";
import {
  type FormEvent,
  type InvalidEvent,
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  HOTEL_EXPERIENCE_CATEGORIES,
  HOTEL_EXPERIENCE_PREFERENCES,
} from "@/lib/hotel-experience-options";

import { HotelFileUploadField } from "../HotelFileUploadField";
import {
  HotelAmenitiesSelector,
  getLegacyAmenities,
  getSelectedAmenityIds,
} from "../HotelAmenitiesSelector";
import { HotelGalleryEditor } from "../HotelGalleryEditor";
import { HotelPoliciesEditor, type PolicyErrors, type PolicyItem } from "../HotelPoliciesEditor";

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

type ExperienceItem = {
  id: string;
  title: string;
  city: string;
  state: string;
  shortDescription: string;
  imageUrl: string;
  imageAlt: string;
  categories: string[];
  preferences: string[];
  distanceText: string;
  isActive: boolean;
};

type ExperienceErrors = Record<
  string,
  Partial<
    Record<
      "title" | "city" | "state" | "shortDescription" | "imageUrl" | "imageAlt" | "categories",
      string
    >
  >
>;

type HotelEditorFormProps = {
  action: (state: HotelEditorState, formData: FormData) => Promise<HotelEditorState>;
  canEditMapLocation: boolean;
  hasResolvedMapLocation: boolean;
  hotel: {
    id: string;
    name: string;
    slug: string;
    shortDescription: string;
    fullDescription: string;
    city: string;
    state: string;
    address: string;
    latitude: string | null;
    longitude: string | null;
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
    experiences: Array<{
      id: string;
      title: string;
      city: string;
      state: string;
      shortDescription: string;
      imageUrl: string;
      imageAlt: string;
      categories: string[];
      preferences: string[];
      distanceText: string | null;
      isActive: boolean;
    }>;
  };
};

function createEmptyExperience(): ExperienceItem {
  return {
    id: `new-experience-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    city: "",
    state: "",
    shortDescription: "",
    imageUrl: "",
    imageAlt: "",
    categories: [],
    preferences: [],
    distanceText: "",
    isActive: true,
  };
}

export function HotelEditorForm({
  action,
  canEditMapLocation,
  hasResolvedMapLocation,
  hotel,
}: HotelEditorFormProps) {
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
  const [experiences, setExperiences] = useState<ExperienceItem[]>(
    hotel.experiences.map((experience) => ({
      id: experience.id,
      title: experience.title,
      city: experience.city,
      state: experience.state,
      shortDescription: experience.shortDescription,
      imageUrl: experience.imageUrl,
      imageAlt: experience.imageAlt,
      categories: experience.categories,
      preferences: experience.preferences,
      distanceText: experience.distanceText ?? "",
      isActive: experience.isActive,
    }))
  );
  const [experienceErrors, setExperienceErrors] = useState<ExperienceErrors>({});
  const [experienceFormError, setExperienceFormError] = useState("");
  const [experienceUploadFiles, setExperienceUploadFiles] = useState<Record<string, File | null>>(
    {}
  );
  const [uploadingExperienceId, setUploadingExperienceId] = useState<string | null>(null);

  const experiencesValue = useMemo(
    () =>
      JSON.stringify(
        experiences.map((experience) => ({
          title: experience.title,
          city: experience.city,
          state: experience.state,
          shortDescription: experience.shortDescription,
          imageUrl: experience.imageUrl,
          imageAlt: experience.imageAlt,
          categories: experience.categories,
          preferences: experience.preferences,
          distanceText: experience.distanceText.trim() || null,
          isActive: experience.isActive,
        }))
      ),
    [experiences]
  );

  const selectedAmenityIds = useMemo(
    () => getSelectedAmenityIds(hotel.amenities),
    [hotel.amenities]
  );
  const legacyAmenities = useMemo(() => getLegacyAmenities(hotel.amenities), [hotel.amenities]);

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

  async function handleExperienceUpload(experienceId: string) {
    const file = experienceUploadFiles[experienceId];
    const experience = experiences.find((item) => item.id === experienceId);

    if (!file || !experience) {
      setUploadFeedbackType("error");
      setUploadFeedback("Selecione a imagem da experiência.");
      return;
    }

    if (!experience.imageAlt.trim()) {
      setExperienceErrors((current) => ({
        ...current,
        [experienceId]: {
          ...current[experienceId],
          imageAlt: "Informe o texto alternativo antes de enviar a imagem.",
        },
      }));
      setExperienceFormError("Revise os campos destacados antes de salvar.");
      return;
    }

    setUploadingExperienceId(experienceId);
    setUploadFeedback("");

    try {
      const payload = new FormData();
      payload.set("file", file);
      payload.set("alt", experience.imageAlt.trim());

      const response = await fetch(`/api/admin/hoteis/${hotel.id}/upload`, {
        method: "POST",
        body: payload,
      });

      const result = (await response.json()) as {
        error?: string;
        images?: Array<{ id: string; url: string; alt: string }>;
      };

      if (!response.ok || !result.images?.length) {
        throw new Error(result.error || "Não foi possível concluir o upload da experiência.");
      }

      const uploadedImage = result.images[0];
      setExperiences((current) =>
        current.map((item) =>
          item.id === experienceId
            ? { ...item, imageUrl: uploadedImage.url, imageAlt: uploadedImage.alt }
            : item
        )
      );
      setExperienceUploadFiles((current) => ({
        ...current,
        [experienceId]: null,
      }));
      setExperienceErrors((current) => ({
        ...current,
        [experienceId]: {
          ...current[experienceId],
          imageUrl: undefined,
          imageAlt: undefined,
        },
      }));
      setUploadFeedbackType("success");
      setUploadFeedback("Imagem da experiência enviada com sucesso.");
    } catch (error) {
      setUploadFeedbackType("error");
      setUploadFeedback(
        error instanceof Error
          ? error.message
          : "Não foi possível concluir o upload da experiência."
      );
    } finally {
      setUploadingExperienceId(null);
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

  function updateExperience(
    id: string,
    field: Exclude<keyof ExperienceItem, "id" | "categories" | "preferences" | "isActive">,
    value: string
  ) {
    setExperiences((current) =>
      current.map((experience) =>
        experience.id === id ? { ...experience, [field]: value } : experience
      )
    );
    setExperienceErrors((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field === "imageUrl" ? "imageUrl" : field]: undefined,
      },
    }));
    setExperienceFormError("");
  }

  function toggleExperienceSelection(
    id: string,
    field: "categories" | "preferences",
    value: string
  ) {
    setExperiences((current) =>
      current.map((experience) => {
        if (experience.id !== id) {
          return experience;
        }

        const values = new Set(experience[field]);

        if (values.has(value)) {
          values.delete(value);
        } else {
          values.add(value);
        }

        return {
          ...experience,
          [field]: [...values],
        };
      })
    );
    setExperienceErrors((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field === "categories" ? "categories" : "categories"]: undefined,
      },
    }));
    setExperienceFormError("");
  }

  function updateExperienceStatus(id: string, isActive: boolean) {
    setExperiences((current) =>
      current.map((experience) => (experience.id === id ? { ...experience, isActive } : experience))
    );
    setExperienceFormError("");
  }

  function addExperience() {
    setExperiences((current) => [...current, createEmptyExperience()]);
    setExperienceFormError("");
  }

  function removeExperience(id: string) {
    setExperiences((current) => current.filter((experience) => experience.id !== id));
    setExperienceErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[id];
      return nextErrors;
    });
    setExperienceUploadFiles((current) => {
      const nextFiles = { ...current };
      delete nextFiles[id];
      return nextFiles;
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

  function validateExperiences() {
    const nextErrors: ExperienceErrors = {};

    experiences.forEach((experience) => {
      const itemErrors: ExperienceErrors[string] = {};
      const title = experience.title.trim();
      const city = experience.city.trim();
      const state = experience.state.trim();
      const shortDescription = experience.shortDescription.trim();
      const imageUrl = experience.imageUrl.trim();
      const imageAlt = experience.imageAlt.trim();

      if (title.length < 2) {
        itemErrors.title = "Informe o título da experiência.";
      }

      if (city.length < 2) {
        itemErrors.city = "Informe a cidade.";
      }

      if (!/^[A-Za-z]{2}$/.test(state)) {
        itemErrors.state = "Informe o estado com 2 letras.";
      }

      if (shortDescription.length < 10) {
        itemErrors.shortDescription = "Use pelo menos 10 caracteres.";
      }

      if (!imageUrl) {
        itemErrors.imageUrl = "Envie a imagem da experiência.";
      }

      if (imageAlt.length < 2) {
        itemErrors.imageAlt = "Informe o texto alternativo da imagem.";
      }

      if (experience.categories.length === 0) {
        itemErrors.categories = "Selecione pelo menos uma categoria.";
      }

      if (Object.keys(itemErrors).length > 0) {
        nextErrors[experience.id] = itemErrors;
      }
    });

    setExperienceErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setExperienceFormError("Revise os campos destacados antes de salvar.");
      return false;
    }

    setExperienceFormError("");
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

  function handleContactEmailInvalid(event: InvalidEvent<HTMLInputElement>) {
    event.currentTarget.setCustomValidity(
      event.currentTarget.validity.valueMissing
        ? "Informe o e-mail de contato do hotel."
        : "Informe um e-mail de contato valido."
    );
  }

  function clearContactEmailValidity(event: FormEvent<HTMLInputElement>) {
    event.currentTarget.setCustomValidity("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const hasAmenities = formData.getAll("amenities").length > 0;
    const hasValidPolicies = validatePolicies();
    const hasValidExperiences = validateExperiences();

    setAmenityFormError(hasAmenities ? "" : "Selecione pelo menos uma comodidade.");

    if (!hasAmenities || !hasValidPolicies || !hasValidExperiences) {
      event.preventDefault();
    }
  }

  return (
    <form action={formAction} className="admin-editor-form" onSubmit={handleSubmit}>
      <input type="hidden" name="isPublished" value={hotel.isPublished ? "on" : "off"} />

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
        {!hasResolvedMapLocation ? (
          <div className="admin-editor-banner">
            <strong>Este hotel ainda não possui localização no mapa.</strong>
            <p>Revise cidade e estado ou defina coordenadas internas antes da aprovação.</p>
          </div>
        ) : null}
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
          {canEditMapLocation ? (
            <>
              <label className="admin-form-field">
                <span>Latitude interna</span>
                <input
                  name="latitude"
                  defaultValue={hotel.latitude ?? ""}
                  inputMode="decimal"
                  placeholder="-23.550520"
                />
              </label>
              <label className="admin-form-field">
                <span>Longitude interna</span>
                <input
                  name="longitude"
                  defaultValue={hotel.longitude ?? ""}
                  inputMode="decimal"
                  placeholder="-46.633308"
                />
              </label>
              <p className="admin-rooms-copy admin-form-field--full">
                Campos internos. Se ficarem vazios, o sistema tenta posicionar o hotel pelo par
                cidade/estado quando houver mapeamento seguro.
              </p>
            </>
          ) : null}
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
            <span>E-mail de contato do hotel</span>
            <input
              type="email"
              name="email"
              defaultValue={hotel.email}
              required
              placeholder="reservas@hotel.com"
              onInvalid={handleContactEmailInvalid}
              onInput={clearContactEmailValidity}
            />
            <small>As solicitações de reserva do site serão enviadas para este e-mail.</small>
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
        <HotelGalleryEditor
          mode="edit"
          hotelName={hotel.name}
          coverImageUrl={coverImageUrl}
          coverPreviewUrl={coverPreviewUrl}
          galleryImages={galleryImages}
          galleryPreviewUrls={galleryPreviewUrls}
          coverUploadFileName={coverUploadFile?.name}
          galleryUploadFileNames={galleryUploadFiles.map((file) => file.name)}
          uploadAlt={uploadAlt}
          uploadFeedback={uploadFeedback}
          removingImageId={removingImageId}
          isUploadingCover={isUploadingCover}
          isUploadingGallery={isUploadingGallery}
          onCoverImageUrlChange={setCoverImageUrl}
          onCoverFileChange={(files) => setCoverUploadFile(files?.[0] ?? null)}
          onGalleryFilesChange={(files) => setGalleryUploadFiles(Array.from(files ?? []))}
          onUploadAltChange={setUploadAlt}
          onCoverUpload={handleCoverUpload}
          onGalleryUpload={handleGalleryUpload}
          onRemoveImage={handleRemoveImage}
        />
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Comodidades</h2>
        </div>
        <HotelAmenitiesSelector
          selectedAmenityIds={selectedAmenityIds}
          legacyAmenities={legacyAmenities}
          errorMessage={amenityFormError}
          onChange={() => setAmenityFormError("")}
        />
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Políticas</h2>
        </div>
        <HotelPoliciesEditor
          policies={policies}
          policyErrors={policyErrors}
          policyFormError={policyFormError}
          onAddPolicy={addPolicy}
          onMovePolicy={movePolicy}
          onRemovePolicy={removePolicy}
          onUpdatePolicy={updatePolicy}
          serializePolicyValue={serializePolicyValue}
        />
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Experiências próximas</h2>
        </div>
        <div className="admin-policy-editor">
          <div className="admin-policy-editor__intro">
            <p>Cadastre atrações, roteiros e vivências ligadas a este hotel.</p>
            <button type="button" className="admin-secondary-button" onClick={addExperience}>
              Adicionar experiência
            </button>
          </div>

          {experienceFormError ? (
            <p className="admin-form-error admin-form-error--block">{experienceFormError}</p>
          ) : null}

          {experiences.length === 0 ? (
            <div className="hotel-empty-state admin-history-empty">
              <strong>Nenhuma experiência cadastrada ainda.</strong>
              <p>Adicione experiências próximas para enriquecer a recomendação do hotel.</p>
            </div>
          ) : (
            <div className="admin-policy-list-editor">
              {experiences.map((experience, index) => (
                <article
                  key={experience.id}
                  className="admin-policy-editor-item admin-experience-editor-item"
                >
                  <div className="admin-policy-editor-item__top">
                    <strong>Experiência {index + 1}</strong>
                    <div className="admin-policy-editor-item__actions">
                      <label className="admin-experience-toggle">
                        <input
                          type="checkbox"
                          checked={experience.isActive}
                          onChange={(event) =>
                            updateExperienceStatus(experience.id, event.target.checked)
                          }
                        />
                        <span>{experience.isActive ? "Ativa" : "Inativa"}</span>
                      </label>
                      <button
                        type="button"
                        className="admin-remove-image-button"
                        onClick={() => removeExperience(experience.id)}
                      >
                        Remover
                      </button>
                    </div>
                  </div>

                  <div className="admin-form-grid admin-form-grid--two">
                    <label className="admin-form-field">
                      <span>Título</span>
                      <input
                        value={experience.title}
                        maxLength={120}
                        onChange={(event) =>
                          updateExperience(experience.id, "title", event.target.value)
                        }
                        aria-invalid={Boolean(experienceErrors[experience.id]?.title)}
                      />
                      {experienceErrors[experience.id]?.title ? (
                        <small className="admin-form-error">
                          {experienceErrors[experience.id]?.title}
                        </small>
                      ) : null}
                    </label>

                    <label className="admin-form-field">
                      <span>Distância/proximidade</span>
                      <input
                        value={experience.distanceText}
                        maxLength={80}
                        placeholder="Ex.: 8 min de carro"
                        onChange={(event) =>
                          updateExperience(experience.id, "distanceText", event.target.value)
                        }
                      />
                    </label>

                    <label className="admin-form-field">
                      <span>Cidade</span>
                      <input
                        value={experience.city}
                        maxLength={80}
                        onChange={(event) =>
                          updateExperience(experience.id, "city", event.target.value)
                        }
                        aria-invalid={Boolean(experienceErrors[experience.id]?.city)}
                      />
                      {experienceErrors[experience.id]?.city ? (
                        <small className="admin-form-error">
                          {experienceErrors[experience.id]?.city}
                        </small>
                      ) : null}
                    </label>

                    <label className="admin-form-field">
                      <span>Estado</span>
                      <input
                        value={experience.state}
                        maxLength={2}
                        placeholder="SP"
                        onChange={(event) =>
                          updateExperience(experience.id, "state", event.target.value.toUpperCase())
                        }
                        aria-invalid={Boolean(experienceErrors[experience.id]?.state)}
                      />
                      {experienceErrors[experience.id]?.state ? (
                        <small className="admin-form-error">
                          {experienceErrors[experience.id]?.state}
                        </small>
                      ) : null}
                    </label>

                    <label className="admin-form-field admin-form-field--full">
                      <span>Descrição curta</span>
                      <textarea
                        value={experience.shortDescription}
                        rows={3}
                        maxLength={320}
                        onChange={(event) =>
                          updateExperience(experience.id, "shortDescription", event.target.value)
                        }
                        aria-invalid={Boolean(experienceErrors[experience.id]?.shortDescription)}
                      />
                      {experienceErrors[experience.id]?.shortDescription ? (
                        <small className="admin-form-error">
                          {experienceErrors[experience.id]?.shortDescription}
                        </small>
                      ) : null}
                    </label>

                    <label className="admin-form-field">
                      <span>Texto alternativo da imagem</span>
                      <input
                        value={experience.imageAlt}
                        maxLength={140}
                        placeholder="Vista da experiência próxima ao hotel"
                        onChange={(event) =>
                          updateExperience(experience.id, "imageAlt", event.target.value)
                        }
                        aria-invalid={Boolean(experienceErrors[experience.id]?.imageAlt)}
                      />
                      {experienceErrors[experience.id]?.imageAlt ? (
                        <small className="admin-form-error">
                          {experienceErrors[experience.id]?.imageAlt}
                        </small>
                      ) : null}
                    </label>

                    <label className="admin-form-field">
                      <span>Imagem</span>
                      <input
                        value={experience.imageUrl}
                        readOnly
                        placeholder="Envie a imagem da experiência"
                        aria-invalid={Boolean(experienceErrors[experience.id]?.imageUrl)}
                      />
                      {experienceErrors[experience.id]?.imageUrl ? (
                        <small className="admin-form-error">
                          {experienceErrors[experience.id]?.imageUrl}
                        </small>
                      ) : (
                        <small>A URL é preenchida automaticamente após o upload.</small>
                      )}
                    </label>

                    <div className="admin-upload-panel admin-form-field--full">
                      <div className="admin-form-grid admin-form-grid--two">
                        <HotelFileUploadField
                          id={`experience-upload-${experience.id}`}
                          title="Selecionar imagem da experiência"
                          auxiliaryText="PNG, JPG ou WebP até o limite permitido."
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          fileNames={
                            experienceUploadFiles[experience.id]
                              ? [experienceUploadFiles[experience.id]?.name ?? ""]
                              : []
                          }
                          onChange={(files) =>
                            setExperienceUploadFiles((current) => ({
                              ...current,
                              [experience.id]: files?.[0] ?? null,
                            }))
                          }
                        />

                        {experience.imageUrl ? (
                          <div className="admin-image-preview-card admin-experience-preview-card">
                            <span className="admin-image-preview-label">
                              Preview da experiência
                            </span>
                            <ImageWithFallback
                              src={experience.imageUrl}
                              alt={experience.imageAlt || experience.title}
                              fallbackLabel="Imagem da experiência indisponível"
                              width={640}
                              height={360}
                              sizes="(max-width: 900px) 100vw, 40vw"
                              unoptimized
                            />
                          </div>
                        ) : null}
                      </div>

                      <div className="admin-upload-actions">
                        <button
                          type="button"
                          className="card-cta-button admin-edit-button"
                          onClick={() => handleExperienceUpload(experience.id)}
                          disabled={
                            uploadingExperienceId === experience.id ||
                            !experienceUploadFiles[experience.id]
                          }
                        >
                          {uploadingExperienceId === experience.id
                            ? "Enviando imagem..."
                            : "Enviar imagem"}
                        </button>
                      </div>
                    </div>

                    <div className="admin-form-field admin-form-field--full">
                      <span>Categorias do quiz</span>
                      <div
                        className="admin-amenities-grid"
                        role="group"
                        aria-label={`Categorias da experiência ${index + 1}`}
                      >
                        {HOTEL_EXPERIENCE_CATEGORIES.map((category) => (
                          <label
                            key={`${experience.id}-${category}`}
                            className="admin-amenity-card"
                          >
                            <input
                              type="checkbox"
                              checked={experience.categories.includes(category)}
                              onChange={() =>
                                toggleExperienceSelection(experience.id, "categories", category)
                              }
                            />
                            <span className="admin-amenity-card__content">
                              <strong>{category}</strong>
                              <small>Categoria do quiz</small>
                            </span>
                          </label>
                        ))}
                      </div>
                      {experienceErrors[experience.id]?.categories ? (
                        <small className="admin-form-error">
                          {experienceErrors[experience.id]?.categories}
                        </small>
                      ) : null}
                    </div>

                    <div className="admin-form-field admin-form-field--full">
                      <span>Preferências relacionadas</span>
                      <div
                        className="admin-amenities-grid"
                        role="group"
                        aria-label={`Preferências da experiência ${index + 1}`}
                      >
                        {HOTEL_EXPERIENCE_PREFERENCES.map((preference) => (
                          <label
                            key={`${experience.id}-${preference}`}
                            className="admin-amenity-card"
                          >
                            <input
                              type="checkbox"
                              checked={experience.preferences.includes(preference)}
                              onChange={() =>
                                toggleExperienceSelection(experience.id, "preferences", preference)
                              }
                            />
                            <span className="admin-amenity-card__content">
                              <strong>{preference}</strong>
                              <small>Preferência relacionada</small>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}

          <input type="hidden" name="experiences" value={experiencesValue} />
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

      <div className="admin-editor-actions">
        <button type="submit" className="card-cta-button" disabled={isPending}>
          {isPending ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
