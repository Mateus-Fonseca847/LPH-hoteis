"use client";

import { useActionState } from "react";

import type { HotelOwnerSignupReviewState } from "./actions";

type ReviewAction = (
  state: HotelOwnerSignupReviewState,
  formData: FormData
) => Promise<HotelOwnerSignupReviewState>;

type ReviewRequestFormProps = {
  approveAction: ReviewAction;
  rejectAction: ReviewAction;
};

const initialState: HotelOwnerSignupReviewState = {
  status: "idle",
  message: "",
};

export function ReviewRequestForm({ approveAction, rejectAction }: ReviewRequestFormProps) {
  const [approveState, approveFormAction, isApproving] = useActionState(
    approveAction,
    initialState
  );
  const [rejectState, rejectFormAction, isRejecting] = useActionState(rejectAction, initialState);
  const isPending = isApproving || isRejecting;

  return (
    <div className="admin-admin-permissions">
      <form action={approveFormAction} className="admin-admin-permission-card">
        <label className="admin-form-field">
          <span>Observação da aprovação</span>
          <textarea name="reviewNote" maxLength={1000} rows={2} />
        </label>
        <button type="submit" className="card-cta-button admin-edit-button" disabled={isPending}>
          {isApproving ? "Aprovando..." : "Aprovar e criar hotel_admin"}
        </button>
        {approveState.message ? (
          <p
            className={
              approveState.status === "success"
                ? "admin-security-feedback is-success"
                : "admin-form-error admin-form-error--block"
            }
            role={approveState.status === "error" ? "alert" : "status"}
          >
            {approveState.message}
          </p>
        ) : null}
      </form>

      <form action={rejectFormAction} className="admin-admin-permission-card">
        <label className="admin-form-field">
          <span>Motivo da rejeição</span>
          <textarea name="reviewNote" maxLength={1000} rows={2} />
        </label>
        <button type="submit" className="admin-secondary-button" disabled={isPending}>
          {isRejecting ? "Rejeitando..." : "Rejeitar solicitação"}
        </button>
        {rejectState.message ? (
          <p
            className={
              rejectState.status === "success"
                ? "admin-security-feedback is-success"
                : "admin-form-error admin-form-error--block"
            }
            role={rejectState.status === "error" ? "alert" : "status"}
          >
            {rejectState.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}
