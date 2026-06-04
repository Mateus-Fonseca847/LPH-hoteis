"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type InvalidEvent,
} from "react";

import { HotelAmenitiesSelector, type LegacyAmenityItem } from "../HotelAmenitiesSelector";
import { HotelGalleryEditor } from "../HotelGalleryEditor";
import { HotelPoliciesEditor, type PolicyErrors, type PolicyItem } from "../HotelPoliciesEditor";
import { createHotelAction, type CreateHotelState } from "../actions";

const initialState: CreateHotelState = {
  status: "idle",
  message: "",
};

const EMPTY_AMENITIES = new Set<string>();
const EMPTY_LEGACY_AMENITIES: LegacyAmenityItem[] = [];

function createEmptyPolicy(): PolicyItem {
  return {
    id: `new-policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    description: "",
  };
}

function validatePolicies(policies: PolicyItem[]) {
  const errors: PolicyErrors = {};

  policies.forEach((policy) => {
    const nextError: PolicyErrors[string] = {};

    if (!policy.title.trim()) {
      nextError.title = "Informe o título da política.";
    }

    if (!policy.description.trim()) {
      nextError.description = "Informe a descrição da política.";
    }

    if (nextError.title || nextError.description) {
      errors[policy.id] = nextError;
    }
  });

  return errors;
}

export function CreateHotelForm() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(createHotelAction, initialState);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [coverFileName, setCoverFileName] = useState("");
  const [uploadAlt, setUploadAlt] = useState("");
  const [amenityFormError, setAmenityFormError] = useState("");
  const [policies, setPolicies] = useState<PolicyItem[]>([]);
  const [policyErrors, setPolicyErrors] = useState<PolicyErrors>({});
  const [policyFormError, setPolicyFormError] = useState("");

  const hasPolicyEntries = useMemo(
    () => policies.some((policy) => policy.title.trim() || policy.description.trim()),
    [policies]
  );

  useEffect(() => {
    if (state.status !== "success" || !state.hotelId) {
      return;
    }

    const timeout = window.setTimeout(() => {
      router.push(`/admin/hoteis/${state.hotelId}`);
    }, 650);

    return () => window.clearTimeout(timeout);
  }, [router, state.hotelId, state.status]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
  }, [coverPreviewUrl]);

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

  function handleCoverImageChange(fileList: FileList | null) {
    const file = fileList?.[0];

    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
    }

    if (!file) {
      setCoverPreviewUrl(null);
      setCoverFileName("");
      return;
    }

    setCoverFileName(file.name);
    setCoverPreviewUrl(URL.createObjectURL(file));
  }

  function addPolicy() {
    setPolicies((current) => [...current, createEmptyPolicy()]);
    setPolicyFormError("");
  }

  function movePolicy(id: string, direction: -1 | 1) {
    setPolicies((current) => {
      const index = current.findIndex((policy) => policy.id === id);

      if (index < 0) {
        return current;
      }

      const nextIndex = index + direction;

      if (nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      const [policy] = next.splice(index, 1);
      next.splice(nextIndex, 0, policy);
      return next;
    });
  }

  function removePolicy(id: string) {
    setPolicies((current) => current.filter((policy) => policy.id !== id));
    setPolicyErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }

  function updatePolicy(id: string, field: "title" | "description", value: string) {
    setPolicies((current) =>
      current.map((policy) => (policy.id === id ? { ...policy, [field]: value } : policy))
    );
    setPolicyErrors((current) => {
      const next = { ...current };

      if (next[id]) {
        next[id] = {
          ...next[id],
          [field]: undefined,
        };
      }

      return next;
    });
    setPolicyFormError("");
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const formData = new FormData(event.currentTarget);
    const selectedAmenities = formData.getAll("amenities").filter((value) => String(value).trim());
    const nextPolicyErrors = validatePolicies(policies);

    let hasError = false;

    if (selectedAmenities.length === 0) {
      setAmenityFormError("Selecione ao menos uma comodidade.");
      hasError = true;
    }

    if (!hasPolicyEntries) {
      setPolicyFormError("Adicione ao menos uma política.");
      hasError = true;
    } else if (Object.keys(nextPolicyErrors).length > 0) {
      setPolicyErrors(nextPolicyErrors);
      hasError = true;
    }

    if (hasError) {
      event.preventDefault();
      return;
    }

    setAmenityFormError("");
    setPolicyErrors({});
    setPolicyFormError("");
  }

  return (
    <form
      action={formAction}
      onSubmit={handleSubmit}
      className="admin-editor-form admin-create-hotel-form"
    >
      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Dados principais</h2>
        </div>
        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>Nome</span>
            <input name="name" required minLength={3} maxLength={120} placeholder="LPH Centro" />
          </label>

          <label className="admin-form-field">
            <span>Slug</span>
            <input
              name="slug"
              required
              minLength={3}
              maxLength={80}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              placeholder="lph-centro"
            />
            <small>Use letras minúsculas, números e hífens.</small>
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
            <input name="city" required minLength={2} maxLength={80} placeholder="São Paulo" />
          </label>

          <label className="admin-form-field">
            <span>Estado</span>
            <input name="state" required minLength={2} maxLength={2} placeholder="SP" />
          </label>

          <label className="admin-form-field admin-form-field--full">
            <span>Endereço</span>
            <input
              name="address"
              required
              minLength={8}
              maxLength={180}
              placeholder="Rua, número - Bairro, Cidade - UF"
            />
          </label>

          <div className="admin-editor-banner admin-form-field--full">
            <strong>Localização no mapa</strong>
            <p>
              O sistema tenta posicionar o hotel pelo par cidade/estado. Depois do primeiro save, o
              super_admin pode ajustar coordenadas internas na edição.
            </p>
          </div>
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Contato</h2>
        </div>
        <div className="admin-form-grid admin-form-grid--three">
          <label className="admin-form-field">
            <span>Telefone</span>
            <input name="phone" required maxLength={24} placeholder="(11) 3000-0000" />
          </label>

          <label className="admin-form-field">
            <span>E-mail de contato do hotel</span>
            <input
              name="email"
              type="email"
              required
              maxLength={160}
              placeholder="reservas@hotel.com"
              onInvalid={handleContactEmailInvalid}
              onInput={clearContactEmailValidity}
            />
            <small>Este e-mail receberá as solicitações de reserva enviadas pelo site.</small>
          </label>

          <label className="admin-form-field">
            <span>WhatsApp</span>
            <input name="whatsapp" required maxLength={24} placeholder="(11) 99999-0000" />
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
              required
              minLength={10}
              maxLength={220}
              rows={3}
              placeholder="Resumo comercial da unidade."
            />
          </label>

          <label className="admin-form-field">
            <span>Descrição completa</span>
            <textarea
              name="fullDescription"
              required
              minLength={30}
              maxLength={4000}
              rows={6}
              placeholder="Texto completo do perfil público do hotel."
            />
          </label>
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Galeria</h2>
        </div>
        <HotelGalleryEditor
          mode="create"
          hotelName=""
          coverImageUrl=""
          coverPreviewUrl={coverPreviewUrl}
          galleryImages={[]}
          coverUploadFileName={coverFileName}
          galleryUploadFileNames={[]}
          uploadAlt={uploadAlt}
          onCoverFileChange={handleCoverImageChange}
          onUploadAltChange={setUploadAlt}
        />
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Comodidades</h2>
        </div>
        <HotelAmenitiesSelector
          selectedAmenityIds={EMPTY_AMENITIES}
          legacyAmenities={EMPTY_LEGACY_AMENITIES}
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
          serializePolicyValue={(policy) =>
            JSON.stringify({
              title: policy.title,
              description: policy.description,
            })
          }
        />
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Experiências próximas</h2>
        </div>
        <div className="admin-editor-banner">
          <strong>Disponível após salvar o rascunho</strong>
          <p>
            Salve os dados básicos para adicionar experiências, imagens vinculadas e preferências do
            quiz na edição do hotel.
          </p>
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Horários</h2>
        </div>
        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>Check-in</span>
            <input name="checkInTime" type="time" required defaultValue="14:00" />
          </label>

          <label className="admin-form-field">
            <span>Check-out</span>
            <input name="checkOutTime" type="time" required defaultValue="12:00" />
          </label>
        </div>
      </section>

      <section className="hotel-content-card admin-form-section">
        <div className="section-heading admin-subsection-heading">
          <h2>Status</h2>
        </div>
        <div className="admin-editor-banner">
          <strong>Rascunho obrigatório</strong>
          <p>
            O hotel começa como rascunho. Após salvar, complete quartos, tarifas, disponibilidade e
            experiências antes de enviar para aprovação.
          </p>
        </div>
      </section>

      {state.message ? (
        <p
          className={`admin-editor-feedback ${state.status === "success" ? "is-success" : "is-error"}`}
          aria-live="polite"
        >
          {state.message}
        </p>
      ) : null}

      <div className="admin-editor-actions">
        <button
          type="submit"
          className="card-cta-button admin-create-hotel-submit"
          disabled={isPending}
        >
          {isPending ? "Salvando..." : "Salvar rascunho e continuar"}
        </button>
        <Link href="/admin" className="admin-secondary-button">
          Cancelar
        </Link>
      </div>
    </form>
  );
}
