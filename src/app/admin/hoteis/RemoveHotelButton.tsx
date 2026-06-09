"use client";

import { useActionState, useEffect, useId, useState } from "react";
import { useRouter } from "next/navigation";

import type { RemoveHotelState } from "./actions";

type RemoveHotelAction = (state: RemoveHotelState, formData: FormData) => Promise<RemoveHotelState>;

type RemoveHotelButtonProps = {
  action: RemoveHotelAction;
  hotelName: string;
};

const initialState: RemoveHotelState = {
  status: "idle",
  message: "",
};

export function RemoveHotelButton({ action, hotelName }: RemoveHotelButtonProps) {
  const titleId = useId();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(action, initialState);

  useEffect(() => {
    if (state.status === "success") {
      setIsOpen(false);
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <>
      <button
        type="button"
        className="admin-secondary-button admin-remove-hotel-trigger"
        onClick={() => setIsOpen(true)}
      >
        Remover
      </button>

      {isOpen ? (
        <div className="admin-confirmation-modal" role="presentation">
          <div
            className="admin-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
          >
            <h2 id={titleId}>Remover hotel</h2>
            <p>
              Tem certeza que deseja remover {hotelName}? Esta ação arquiva a unidade e pode afetar
              quartos, tarifas, disponibilidade, experiências, imagens e permissões relacionadas.
            </p>
            <p>
              Hotéis com reservas vinculadas não serão removidos. Remova apenas quando tiver certeza
              de que a unidade deve sair do painel e do site público.
            </p>

            <form action={formAction} className="admin-confirmation-actions">
              <button
                type="button"
                className="admin-secondary-button"
                disabled={isPending}
                onClick={() => setIsOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="card-cta-button admin-remove-hotel-button"
                disabled={isPending}
              >
                {isPending ? "Removendo..." : "Remover hotel"}
              </button>
            </form>

            {state.message ? (
              <p
                className={
                  state.status === "success"
                    ? "admin-security-feedback is-success"
                    : "admin-form-error admin-form-error--block"
                }
                role={state.status === "error" ? "alert" : "status"}
              >
                {state.message}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
