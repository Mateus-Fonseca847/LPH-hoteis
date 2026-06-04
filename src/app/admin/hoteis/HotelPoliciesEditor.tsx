"use client";

export type PolicyItem = {
  id: string;
  title: string;
  description: string;
};

export type PolicyErrors = Record<string, Partial<Record<"title" | "description", string>>>;

type HotelPoliciesEditorProps = {
  policies: PolicyItem[];
  policyErrors: PolicyErrors;
  policyFormError: string;
  onAddPolicy: () => void;
  onMovePolicy: (id: string, direction: -1 | 1) => void;
  onRemovePolicy: (id: string) => void;
  onUpdatePolicy: (id: string, field: "title" | "description", value: string) => void;
  serializePolicyValue: (policy: PolicyItem) => string;
};

export function HotelPoliciesEditor({
  policies,
  policyErrors,
  policyFormError,
  onAddPolicy,
  onMovePolicy,
  onRemovePolicy,
  onUpdatePolicy,
  serializePolicyValue,
}: HotelPoliciesEditorProps) {
  return (
    <div className="admin-policy-editor">
      <div className="admin-policy-editor__intro">
        <p>Cadastre regras claras para orientar o hóspede antes da reserva.</p>
        <button type="button" className="admin-secondary-button" onClick={onAddPolicy}>
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
                    onClick={() => onMovePolicy(policy.id, -1)}
                    disabled={index === 0}
                  >
                    Subir
                  </button>
                  <button
                    type="button"
                    className="admin-secondary-button"
                    onClick={() => onMovePolicy(policy.id, 1)}
                    disabled={index === policies.length - 1}
                  >
                    Descer
                  </button>
                  <button
                    type="button"
                    className="admin-remove-image-button"
                    onClick={() => onRemovePolicy(policy.id)}
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
                    onChange={(event) => onUpdatePolicy(policy.id, "title", event.target.value)}
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
                      onUpdatePolicy(policy.id, "description", event.target.value)
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
  );
}
