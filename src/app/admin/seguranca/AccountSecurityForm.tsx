"use client";

import { useState, useTransition } from "react";

import {
  disableEmailTwoFactorAction,
  enableEmailTwoFactorAction,
  sendTestEmailAction,
  type AccountSecurityActionState,
} from "./actions";

type AccountSecurityFormProps = {
  emailTwoFactorEnabled: boolean;
  isAdmin: boolean;
};

const idleState: AccountSecurityActionState = {
  status: "idle",
  message: "",
};

export function AccountSecurityForm({ emailTwoFactorEnabled, isAdmin }: AccountSecurityFormProps) {
  const [state, setState] = useState<AccountSecurityActionState>(idleState);
  const [isPending, startTransition] = useTransition();
  const canDisable = emailTwoFactorEnabled && !isAdmin;

  function handleEnable() {
    startTransition(async () => {
      setState(await enableEmailTwoFactorAction());
    });
  }

  function handleDisable() {
    startTransition(async () => {
      setState(await disableEmailTwoFactorAction());
    });
  }

  function handleSendTestEmail() {
    startTransition(async () => {
      setState(await sendTestEmailAction());
    });
  }

  return (
    <div className="admin-security-actions">
      <button
        type="button"
        className="card-cta-button admin-edit-button"
        onClick={handleEnable}
        disabled={isPending || emailTwoFactorEnabled}
      >
        {emailTwoFactorEnabled ? "2FA por e-mail ativo" : "Ativar 2FA por e-mail"}
      </button>

      <button
        type="button"
        className="admin-secondary-button"
        onClick={handleDisable}
        disabled={isPending || !canDisable}
      >
        Desativar 2FA por e-mail
      </button>

      <button
        type="button"
        className="admin-secondary-button"
        onClick={handleSendTestEmail}
        disabled={isPending}
      >
        Enviar e-mail de teste
      </button>

      {isAdmin ? (
        <p className="admin-availability-note">
          Administradores devem manter 2FA por e-mail ativo. A desativação exige uma política
          explicita do sistema.
        </p>
      ) : null}

      {state.message ? (
        <p
          className={
            state.status === "success"
              ? "admin-security-feedback is-success"
              : "admin-form-error admin-form-error--block"
          }
        >
          {state.message}
        </p>
      ) : null}
    </div>
  );
}
