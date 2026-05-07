"use client";

import { useActionState } from "react";

import type { HotelPaymentSettingsState } from "./payment-actions";

const initialState: HotelPaymentSettingsState = {
  status: "idle",
  message: "",
};

type HotelPaymentSettingsFormProps = {
  action: (
    state: HotelPaymentSettingsState,
    formData: FormData
  ) => Promise<HotelPaymentSettingsState>;
  settings: {
    provider: "manual" | "mercado_pago";
    isEnabled: boolean;
    receiverLabel: string;
    publicKey: string | null;
    hasAccessToken: boolean;
    pixKey: string | null;
    payoutDocument: string | null;
  };
  isConfigured: boolean;
};

export function HotelPaymentSettingsForm({
  action,
  settings,
  isConfigured,
}: HotelPaymentSettingsFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <section className="hotel-content-card admin-form-section">
      <div className="section-heading admin-subsection-heading">
        <h2>Pagamentos</h2>
      </div>

      <form action={formAction} className="admin-payment-settings-form">
        {state.message ? (
          <p
            className={`admin-editor-feedback ${state.status === "success" ? "is-success" : "is-error"}`}
          >
            {state.message}
          </p>
        ) : null}

        <div className="admin-editor-banner">
          <strong>
            {isConfigured ? "Configuração de pagamento" : "Pagamento não configurado"}
          </strong>
          <p>
            {isConfigured
              ? "Informe o destino de pagamento do hotel. Credenciais sensíveis salvas não são exibidas novamente."
              : "Este hotel ainda não possui configuração de pagamento. Salve os dados abaixo para criar uma configuração inativa por padrão."}
          </p>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>Provedor de pagamento</span>
            <select name="provider" defaultValue={settings.provider}>
              <option value="manual">Manual</option>
              <option value="mercado_pago">Mercado Pago</option>
            </select>
          </label>

          <label className="admin-form-field">
            <span>Identificador da conta recebedora</span>
            <input
              name="receiverLabel"
              defaultValue={settings.receiverLabel}
              required
              maxLength={120}
              placeholder="ID, nome ou apelido da conta recebedora"
            />
            <small>
              Use um identificador interno claro para reconhecer o destino dos repasses.
            </small>
          </label>
        </div>

        <label className="admin-toggle-field">
          <input type="checkbox" name="isEnabled" defaultChecked={settings.isEnabled} />
          <span>Pagamentos ativos para este hotel</span>
        </label>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>Public key</span>
            <input
              name="publicKey"
              defaultValue={settings.publicKey ?? ""}
              maxLength={240}
              placeholder="Chave pública do provedor, se aplicável"
            />
          </label>

          <label className="admin-form-field">
            <span>Credencial sensível</span>
            <input
              name="accessToken"
              type="password"
              maxLength={500}
              placeholder={
                settings.hasAccessToken ? "Credencial já salva. Preencha para substituir." : ""
              }
              autoComplete="new-password"
            />
            <small>
              {settings.hasAccessToken
                ? "Há uma credencial criptografada salva para este hotel."
                : "Nenhuma credencial sensível salva ainda."}
            </small>
          </label>
        </div>

        <div className="admin-form-grid admin-form-grid--two">
          <label className="admin-form-field">
            <span>Chave Pix operacional</span>
            <input
              name="pixKey"
              defaultValue={settings.pixKey ?? ""}
              maxLength={160}
              placeholder="E-mail, CPF/CNPJ, telefone ou chave aleatória"
            />
          </label>

          <label className="admin-form-field">
            <span>Documento do recebedor</span>
            <input
              name="payoutDocument"
              defaultValue={settings.payoutDocument ?? ""}
              maxLength={40}
              placeholder="CPF ou CNPJ"
            />
          </label>
        </div>

        <div className="admin-editor-actions">
          <button type="submit" className="card-cta-button" disabled={isPending}>
            {isPending ? "Salvando pagamentos..." : "Salvar pagamentos"}
          </button>
        </div>
      </form>
    </section>
  );
}
