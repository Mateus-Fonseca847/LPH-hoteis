"use client";

import { useMemo, useState, useTransition } from "react";

import type { AccessibleAdministrator, AdminUserActionState } from "../users/actions";
import {
  createAdministratorAction,
  listAccessibleAdministratorsAction,
  removeUserHotelPermissionAction,
  toggleAdministrativeUserActiveAction,
  updateHotelPermissionAction,
} from "../users/actions";

type HotelRole = "owner" | "admin" | "editor";
type GlobalRole = "super_admin" | "hotel_admin" | "user";

type ManageableHotel = {
  id: string;
  name: string;
  actorHotelRole?: HotelRole;
};

type AdminUsersClientProps = {
  actorGlobalRole: GlobalRole;
  initialAdministrators: AccessibleAdministrator[];
  activationScopeHotelId: string | null;
  manageableHotels: ManageableHotel[];
};

type RoleDrafts = Record<string, HotelRole>;

type InviteForm = {
  name: string;
  email: string;
  globalRole: "super_admin" | "hotel_admin";
  hotelId: string;
  role: HotelRole;
  isActive: boolean;
};

function formatGlobalRole(role: AccessibleAdministrator["globalRole"]) {
  if (role === "super_admin") {
    return "Super admin";
  }

  if (role === "hotel_admin") {
    return "Admin de hotel";
  }

  return "Usuário";
}

function formatPermissionRole(role: HotelRole) {
  if (role === "owner") {
    return "Owner";
  }

  if (role === "admin") {
    return "Admin";
  }

  return "Editor";
}

function formatCreatedAt(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function buildRoleDrafts(administrators: AccessibleAdministrator[]) {
  return Object.fromEntries(
    administrators.flatMap((administrator) =>
      administrator.permissions.map((permission) => [permission.id, permission.role])
    )
  ) as RoleDrafts;
}

function getManageableRoles(actorGlobalRole: GlobalRole, hotel?: ManageableHotel) {
  if (actorGlobalRole === "super_admin") {
    return ["owner", "admin", "editor"] as HotelRole[];
  }

  if (hotel?.actorHotelRole === "owner") {
    return ["admin", "editor"] as HotelRole[];
  }

  if (hotel?.actorHotelRole === "admin") {
    return ["editor"] as HotelRole[];
  }

  return [] as HotelRole[];
}

function getDefaultInviteForm(actorGlobalRole: GlobalRole, hotels: ManageableHotel[]): InviteForm {
  const firstHotel = hotels[0];
  const allowedRoles = getManageableRoles(actorGlobalRole, firstHotel);

  return {
    name: "",
    email: "",
    globalRole: actorGlobalRole === "super_admin" ? "hotel_admin" : "hotel_admin",
    hotelId: firstHotel?.id ?? "",
    role: allowedRoles[0] ?? "editor",
    isActive: true,
  };
}

function validateInviteForm(form: InviteForm) {
  if (form.name.trim().length < 2) {
    return "Informe um nome com pelo menos 2 caracteres.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Informe um e-mail válido.";
  }

  if (!form.hotelId) {
    return "Selecione um hotel.";
  }

  if (!form.role) {
    return "Selecione um papel no hotel.";
  }

  if (!form.globalRole) {
    return "Selecione um papel global.";
  }

  return "";
}

export function AdminUsersClient({
  actorGlobalRole,
  initialAdministrators,
  activationScopeHotelId,
  manageableHotels,
}: AdminUsersClientProps) {
  const [administrators, setAdministrators] = useState(initialAdministrators);
  const [roleDrafts, setRoleDrafts] = useState<RoleDrafts>(() =>
    buildRoleDrafts(initialAdministrators)
  );
  const [inviteForm, setInviteForm] = useState<InviteForm>(() =>
    getDefaultInviteForm(actorGlobalRole, manageableHotels)
  );
  const [feedback, setFeedback] = useState("");
  const [feedbackType, setFeedbackType] = useState<"success" | "error">("success");
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isSuperAdmin = actorGlobalRole === "super_admin";
  const hasAdministrators = administrators.length > 0;
  const selectedHotel = manageableHotels.find((hotel) => hotel.id === inviteForm.hotelId);
  const inviteRoleOptions = getManageableRoles(actorGlobalRole, selectedHotel);
  const totalPermissions = useMemo(
    () =>
      administrators.reduce((total, administrator) => total + administrator.permissions.length, 0),
    [administrators]
  );

  const refreshAdministrators = async () => {
    const result = await listAccessibleAdministratorsAction();

    if (result.status === "error") {
      throw new Error(result.message || "Não foi possível atualizar a lista.");
    }

    setAdministrators(result.administrators);
    setRoleDrafts(buildRoleDrafts(result.administrators));
  };

  const runTask = (
    task: () => Promise<AdminUserActionState>,
    taskKey: string,
    successFallback: string
  ) => {
    setFeedback("");
    setPendingKey(taskKey);

    startTransition(async () => {
      try {
        const result = await task();

        if (result.status === "error") {
          throw new Error(result.message || "Não foi possível concluir a operação.");
        }

        await refreshAdministrators();
        setFeedbackType("success");
        setFeedback(result.message || successFallback);
      } catch (error) {
        setFeedbackType("error");
        setFeedback(
          error instanceof Error ? error.message : "Não foi possível concluir a operação."
        );
      } finally {
        setPendingKey(null);
      }
    });
  };

  const updateInviteHotel = (hotelId: string) => {
    const hotel = manageableHotels.find((item) => item.id === hotelId);
    const nextRoles = getManageableRoles(actorGlobalRole, hotel);

    setInviteForm((current) => ({
      ...current,
      hotelId,
      role: nextRoles.includes(current.role) ? current.role : (nextRoles[0] ?? "editor"),
    }));
  };

  const submitInvite = () => {
    const validationMessage = validateInviteForm(inviteForm);

    if (validationMessage) {
      setFeedbackType("error");
      setFeedback(validationMessage);
      return;
    }

    const payload = {
      name: inviteForm.name,
      email: inviteForm.email,
      globalRole: isSuperAdmin ? inviteForm.globalRole : "hotel_admin",
      hotelId: inviteForm.hotelId,
      role: inviteForm.role,
      isActive: inviteForm.isActive,
    };

    setFeedback("");
    setPendingKey("invite:create");

    startTransition(async () => {
      try {
        const result = await createAdministratorAction(inviteForm.hotelId, payload);

        if (result.status === "error") {
          throw new Error(result.message || "Não foi possível criar o administrador.");
        }

        await refreshAdministrators();
        setInviteForm(getDefaultInviteForm(actorGlobalRole, manageableHotels));
        setFeedbackType("success");
        setFeedback(result.message || "Administrador criado com sucesso.");
      } catch (error) {
        setFeedbackType("error");
        setFeedback(
          error instanceof Error ? error.message : "Não foi possível criar o administrador."
        );
      } finally {
        setPendingKey(null);
      }
    });
  };

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Admin</span>
        <h1>Administradores</h1>
        <p className="admin-rooms-copy">
          Visualize os usuários administrativos acessíveis no seu escopo e ajuste os vínculos por
          hotel.
        </p>
      </div>

      <div className="admin-overview-grid">
        <article className="hotel-content-card admin-overview-card">
          <span>Total de administradores</span>
          <strong>{administrators.length}</strong>
          <p>Somente usuários visíveis dentro do seu escopo atual.</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Vínculos por hotel</span>
          <strong>{totalPermissions}</strong>
          <p>Papéis por hotel carregados conforme a sua permissão.</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Seu escopo</span>
          <strong>{isSuperAdmin ? "Global" : "Por hotel"}</strong>
          <p>
            {isSuperAdmin
              ? "Pode criar usuários e revisar todos os vínculos."
              : "Pode criar e ajustar vínculos permitidos."}
          </p>
        </article>
      </div>

      <section className="admin-form-section admin-admin-invite-section">
        <div className="admin-subsection-heading">
          <h2>Criar administrador</h2>
          <p className="admin-rooms-copy">
            O envio de convite por e-mail ainda não está implementado. Esta ação cria o usuário e o
            vínculo administrativo para configuração posterior de acesso.
          </p>
        </div>

        {manageableHotels.length === 0 ? (
          <div className="hotel-empty-state admin-history-empty">
            <strong>Nenhum hotel disponível para vínculo.</strong>
            <p>Você precisa ter permissão administrativa em pelo menos um hotel.</p>
          </div>
        ) : (
          <div className="admin-form-grid admin-form-grid--three">
            <label className="admin-form-field">
              <span>Nome</span>
              <input
                value={inviteForm.name}
                onChange={(event) =>
                  setInviteForm((current) => ({ ...current, name: event.target.value }))
                }
                disabled={isPending}
                placeholder="Nome do administrador"
              />
            </label>

            <label className="admin-form-field">
              <span>E-mail</span>
              <input
                type="email"
                value={inviteForm.email}
                onChange={(event) =>
                  setInviteForm((current) => ({ ...current, email: event.target.value }))
                }
                disabled={isPending}
                placeholder="admin@exemplo.com"
              />
            </label>

            {isSuperAdmin ? (
              <label className="admin-form-field">
                <span>Papel global</span>
                <select
                  value={inviteForm.globalRole}
                  onChange={(event) =>
                    setInviteForm((current) => ({
                      ...current,
                      globalRole: event.target.value as "super_admin" | "hotel_admin",
                    }))
                  }
                  disabled={isPending}
                >
                  <option value="hotel_admin">Admin de hotel</option>
                  <option value="super_admin">Super admin</option>
                </select>
              </label>
            ) : (
              <div className="admin-form-field">
                <span>Papel global</span>
                <input value="Admin de hotel" disabled />
              </div>
            )}

            <label className="admin-form-field">
              <span>Hotel</span>
              <select
                value={inviteForm.hotelId}
                onChange={(event) => updateInviteHotel(event.target.value)}
                disabled={isPending}
              >
                {manageableHotels.map((hotel) => (
                  <option key={hotel.id} value={hotel.id}>
                    {hotel.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-form-field">
              <span>Papel no hotel</span>
              <select
                value={inviteForm.role}
                onChange={(event) =>
                  setInviteForm((current) => ({
                    ...current,
                    role: event.target.value as HotelRole,
                  }))
                }
                disabled={isPending || inviteRoleOptions.length === 0}
              >
                {inviteRoleOptions.map((role) => (
                  <option key={role} value={role}>
                    {formatPermissionRole(role)}
                  </option>
                ))}
              </select>
            </label>

            <label className="admin-toggle-field admin-toggle-field--boxed">
              <input
                type="checkbox"
                checked={inviteForm.isActive}
                onChange={(event) =>
                  setInviteForm((current) => ({
                    ...current,
                    isActive: event.target.checked,
                  }))
                }
                disabled={isPending}
              />
              <span>Status ativo</span>
            </label>

            <div className="admin-editor-actions admin-form-field--full">
              <button
                type="button"
                className="card-cta-button admin-edit-button"
                disabled={isPending || manageableHotels.length === 0}
                onClick={submitInvite}
              >
                {pendingKey === "invite:create" ? "Criando..." : "Criar administrador"}
              </button>
            </div>
          </div>
        )}
      </section>

      {feedback ? (
        <p
          className={`admin-editor-feedback ${
            feedbackType === "success" ? "is-success" : "is-error"
          }`}
          role={feedbackType === "error" ? "alert" : "status"}
        >
          {feedback}
        </p>
      ) : null}

      {!hasAdministrators ? (
        <div className="hotel-empty-state admin-history-empty">
          <strong>Nenhum administrador disponível.</strong>
          <p>Quando houver usuários administrativos no seu escopo, eles aparecerão aqui.</p>
        </div>
      ) : (
        <div className="admin-hotels-grid admin-admins-grid">
          {administrators.map((administrator) => (
            <article
              key={administrator.id}
              className="hotel-content-card admin-hotel-card admin-admin-card"
            >
              <div className="admin-hotel-card-top">
                <span>Administrador</span>
                <strong>{administrator.name}</strong>
                <p>{administrator.email}</p>
              </div>

              <div className="admin-hotel-card-meta admin-admin-meta">
                <p>
                  <span>Papel global</span>
                  <strong>{formatGlobalRole(administrator.globalRole)}</strong>
                </p>
                <p>
                  <span>Status</span>
                  <strong>{administrator.isActive ? "Ativo" : "Inativo"}</strong>
                </p>
                <p>
                  <span>Criado em</span>
                  <strong>{formatCreatedAt(administrator.createdAt)}</strong>
                </p>
              </div>

              <div className="admin-admin-permissions">
                <span>Hotéis vinculados</span>
                {administrator.permissions.length === 0 ? (
                  <p className="admin-rooms-copy">Sem vínculos visíveis no seu escopo.</p>
                ) : (
                  <div className="admin-admin-permissions-list">
                    {administrator.permissions.map((permission) => {
                      const currentDraft = roleDrafts[permission.id] ?? permission.role;
                      const permissionKey = `permission:${permission.id}`;
                      const hotel = manageableHotels.find((item) => item.id === permission.hotelId);
                      const permissionRoleOptions = getManageableRoles(actorGlobalRole, hotel);
                      const canEditPermission = permissionRoleOptions.includes(permission.role);

                      return (
                        <div key={permission.id} className="admin-admin-permission-card">
                          <div className="admin-admin-permission-head">
                            <strong>{permission.hotelName}</strong>
                            <span>{formatPermissionRole(permission.role)}</span>
                          </div>

                          <div className="admin-admin-permission-actions">
                            {canEditPermission ? (
                              <label className="admin-form-field">
                                <span>Papel no hotel</span>
                                <select
                                  value={currentDraft}
                                  onChange={(event) =>
                                    setRoleDrafts((current) => ({
                                      ...current,
                                      [permission.id]: event.target.value as HotelRole,
                                    }))
                                  }
                                  disabled={isPending}
                                >
                                  {permissionRoleOptions.map((role) => (
                                    <option key={role} value={role}>
                                      {formatPermissionRole(role)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            ) : (
                              <div className="admin-form-field">
                                <span>Papel no hotel</span>
                                <input value={formatPermissionRole(permission.role)} disabled />
                              </div>
                            )}

                            <div className="admin-room-actions">
                              <button
                                type="button"
                                className="admin-secondary-button"
                                disabled={
                                  isPending ||
                                  !canEditPermission ||
                                  currentDraft === permission.role
                                }
                                onClick={() =>
                                  runTask(
                                    () =>
                                      updateHotelPermissionAction(
                                        permission.hotelId,
                                        permission.id,
                                        {
                                          userId: administrator.id,
                                          hotelId: permission.hotelId,
                                          role: currentDraft,
                                        }
                                      ),
                                    permissionKey,
                                    "Permissão atualizada."
                                  )
                                }
                              >
                                {pendingKey === permissionKey ? "Salvando..." : "Salvar papel"}
                              </button>

                              <button
                                type="button"
                                className="admin-secondary-button"
                                disabled={isPending || !canEditPermission}
                                onClick={() =>
                                  runTask(
                                    () =>
                                      removeUserHotelPermissionAction(
                                        permission.hotelId,
                                        permission.id
                                      ),
                                    `${permissionKey}:remove`,
                                    "Vínculo removido."
                                  )
                                }
                              >
                                {pendingKey === `${permissionKey}:remove`
                                  ? "Removendo..."
                                  : "Remover vínculo"}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {isSuperAdmin ? (
                <div className="admin-room-actions">
                  <button
                    type="button"
                    className="card-cta-button admin-edit-button"
                    disabled={isPending || !activationScopeHotelId}
                    onClick={() =>
                      activationScopeHotelId
                        ? runTask(
                            () =>
                              toggleAdministrativeUserActiveAction(
                                activationScopeHotelId,
                                administrator.id,
                                !administrator.isActive
                              ),
                            `user:${administrator.id}:toggle`,
                            "Status atualizado."
                          )
                        : undefined
                    }
                  >
                    {pendingKey === `user:${administrator.id}:toggle`
                      ? "Atualizando..."
                      : administrator.isActive
                        ? "Desativar"
                        : "Ativar"}
                  </button>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
