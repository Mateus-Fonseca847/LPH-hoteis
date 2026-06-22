"use client";

import { useMemo, useState, useTransition } from "react";

import type { AccessibleAdministrator, AdminUserActionState } from "../users/actions";
import {
  addUserHotelPermissionAction,
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
};

type AdminUsersClientProps = {
  actorGlobalRole: GlobalRole;
  initialAdministrators: AccessibleAdministrator[];
  activationScopeHotelId: string | null;
  manageableHotels: ManageableHotel[];
};

type RoleDrafts = Record<string, HotelRole>;
type PermissionDrafts = Record<string, { hotelId: string; role: HotelRole }>;

type InviteForm = {
  name: string;
  email: string;
  globalRole: "hotel_admin";
  hotelId: string;
  role: HotelRole;
  isActive: boolean;
};

function formatGlobalRole(role: AccessibleAdministrator["globalRole"]) {
  if (role === "super_admin") {
    return "Super administrador";
  }

  if (role === "hotel_admin") {
    return "Administrador do hotel";
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

function getManageableRoles(actorGlobalRole: GlobalRole) {
  if (actorGlobalRole === "super_admin") {
    return ["owner", "admin", "editor"] as HotelRole[];
  }

  return [] as HotelRole[];
}

function getDefaultRole(actorGlobalRole: GlobalRole) {
  const allowedRoles = getManageableRoles(actorGlobalRole);
  return allowedRoles.includes("admin") ? "admin" : (allowedRoles[0] ?? "editor");
}

function getDefaultInviteForm(actorGlobalRole: GlobalRole, hotels: ManageableHotel[]): InviteForm {
  return {
    name: "",
    email: "",
    globalRole: "hotel_admin",
    hotelId: hotels[0]?.id ?? "",
    role: getDefaultRole(actorGlobalRole),
    isActive: true,
  };
}

function buildPermissionDrafts(
  administrators: AccessibleAdministrator[],
  hotels: ManageableHotel[],
  actorGlobalRole: GlobalRole
) {
  return Object.fromEntries(
    administrators.map((administrator) => {
      const linkedHotelIds = new Set(
        administrator.permissions.map((permission) => permission.hotelId)
      );
      const firstAvailableHotel = hotels.find((hotel) => !linkedHotelIds.has(hotel.id));

      return [
        administrator.id,
        {
          hotelId: firstAvailableHotel?.id ?? "",
          role: getDefaultRole(actorGlobalRole),
        },
      ];
    })
  ) as PermissionDrafts;
}

function validateInviteForm(form: InviteForm) {
  if (form.name.trim().length < 2) {
    return "Informe um nome com pelo menos 2 caracteres.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    return "Informe um e-mail valido.";
  }

  if (!form.hotelId) {
    return "Selecione um hotel.";
  }

  if (!form.role) {
    return "Selecione um papel no hotel.";
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
  const [permissionDrafts, setPermissionDrafts] = useState<PermissionDrafts>(() =>
    buildPermissionDrafts(initialAdministrators, manageableHotels, actorGlobalRole)
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
  const inviteRoleOptions = getManageableRoles(actorGlobalRole);
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
    setPermissionDrafts(
      buildPermissionDrafts(result.administrators, manageableHotels, actorGlobalRole)
    );
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

  const submitInvite = () => {
    const validationMessage = validateInviteForm(inviteForm);

    if (validationMessage) {
      setFeedbackType("error");
      setFeedback(validationMessage);
      return;
    }

    setFeedback("");
    setPendingKey("invite:create");

    startTransition(async () => {
      try {
        const result = await createAdministratorAction(inviteForm.hotelId, inviteForm);

        if (result.status === "error") {
          throw new Error(result.message || "Não foi possível criar o administrador.");
        }

        await refreshAdministrators();
        setInviteForm(getDefaultInviteForm(actorGlobalRole, manageableHotels));
        setFeedbackType("success");
        setFeedback(result.message || "Administrador do hotel criado com sucesso.");
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
        <h1>Administradores</h1>
        <p className="admin-rooms-copy">
          Defina quais hotéis cada administrador do hotel pode gerenciar e revise os vínculos existentes.
        </p>
      </div>

      <div className="admin-overview-grid">
        <article className="hotel-content-card admin-overview-card">
          <span>Total de administradores</span>
          <strong>{administrators.length}</strong>
          <p>Apenas administradores de hotel disponíveis para gestão pelo super administrador.</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Vínculos por hotel</span>
          <strong>{totalPermissions}</strong>
          <p>Cada vínculo libera acesso administrativo no hotel selecionado.</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Seu escopo</span>
          <strong>{isSuperAdmin ? "Global" : "Por hotel"}</strong>
          <p>Somente o super administrador pode conceder, alterar ou remover acessos de hotel.</p>
        </article>
      </div>

      <section className="admin-form-section admin-admin-invite-section">
        <div className="admin-subsection-heading">
          <h2>Criar administrador do hotel</h2>
          <p className="admin-rooms-copy">
            Esta ação cria o administrador do hotel e já adiciona o primeiro hotel autorizado.
          </p>
        </div>

        {manageableHotels.length === 0 ? (
          <div className="hotel-empty-state admin-history-empty">
            <strong>Nenhum hotel disponível para vínculo.</strong>
            <p>Cadastre ao menos um hotel antes de liberar acesso administrativo.</p>
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

            <div className="admin-form-field">
              <span>Papel global</span>
              <input value="Administrador do hotel" disabled />
            </div>

            <label className="admin-form-field">
              <span>Primeiro hotel</span>
              <select
                value={inviteForm.hotelId}
                onChange={(event) =>
                  setInviteForm((current) => ({ ...current, hotelId: event.target.value }))
                }
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
          <strong>Nenhum administrador do hotel disponível.</strong>
          <p>Quando houver administradores do hotel cadastrados, eles aparecerão aqui.</p>
        </div>
      ) : (
        <div className="admin-hotels-grid admin-admins-grid">
          {administrators.map((administrator) => {
            const linkedHotelIds = new Set(
              administrator.permissions.map((permission) => permission.hotelId)
            );
            const availableHotels = manageableHotels.filter(
              (hotel) => !linkedHotelIds.has(hotel.id)
            );
            const addDraft = permissionDrafts[administrator.id] ?? {
              hotelId: availableHotels[0]?.id ?? "",
              role: getDefaultRole(actorGlobalRole),
            };
            const selectedAddHotel =
              availableHotels.find((hotel) => hotel.id === addDraft.hotelId) ?? availableHotels[0];
            const addKey = `permission:${administrator.id}:add`;

            return (
              <article
                key={administrator.id}
                className="hotel-content-card admin-hotel-card admin-admin-card"
              >
                <div className="admin-hotel-card-top">
                  <span>Administrador do hotel</span>
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
                    <p className="admin-rooms-copy">
                      Este administrador do hotel ainda não possui hotéis vinculados.
                    </p>
                  ) : (
                    <div className="admin-admin-permissions-list">
                      {administrator.permissions.map((permission) => {
                        const currentDraft = roleDrafts[permission.id] ?? permission.role;
                        const permissionKey = `permission:${permission.id}`;

                        return (
                          <div key={permission.id} className="admin-admin-permission-card">
                            <div className="admin-admin-permission-head">
                              <strong>{permission.hotelName}</strong>
                              <span>{formatPermissionRole(permission.role)}</span>
                            </div>

                            <div className="admin-admin-permission-actions">
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
                                  {inviteRoleOptions.map((role) => (
                                    <option key={role} value={role}>
                                      {formatPermissionRole(role)}
                                    </option>
                                  ))}
                                </select>
                              </label>

                              <div className="admin-room-actions">
                                <button
                                  type="button"
                                  className="admin-secondary-button"
                                  disabled={isPending || currentDraft === permission.role}
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
                                  disabled={isPending}
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

                <div className="admin-admin-permissions">
                  <span>Adicionar hotel</span>
                  {availableHotels.length === 0 ? (
                    <p className="admin-rooms-copy">
                      Todos os hotéis já estão vinculados a este administrador do hotel.
                    </p>
                  ) : (
                    <div className="admin-admin-permission-card">
                      <div className="admin-admin-permission-actions">
                        <label className="admin-form-field">
                          <span>Hotel</span>
                          <select
                            value={selectedAddHotel?.id ?? ""}
                            onChange={(event) =>
                              setPermissionDrafts((current) => ({
                                ...current,
                                [administrator.id]: {
                                  hotelId: event.target.value,
                                  role:
                                    current[administrator.id]?.role ??
                                    getDefaultRole(actorGlobalRole),
                                },
                              }))
                            }
                            disabled={isPending}
                          >
                            {availableHotels.map((hotel) => (
                              <option key={hotel.id} value={hotel.id}>
                                {hotel.name}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="admin-form-field">
                          <span>Papel no hotel</span>
                          <select
                            value={addDraft.role}
                            onChange={(event) =>
                              setPermissionDrafts((current) => ({
                                ...current,
                                [administrator.id]: {
                                  hotelId: selectedAddHotel?.id ?? "",
                                  role: event.target.value as HotelRole,
                                },
                              }))
                            }
                            disabled={isPending}
                          >
                            {inviteRoleOptions.map((role) => (
                              <option key={role} value={role}>
                                {formatPermissionRole(role)}
                              </option>
                            ))}
                          </select>
                        </label>

                        <div className="admin-room-actions">
                          <button
                            type="button"
                            className="admin-secondary-button"
                            disabled={isPending || !selectedAddHotel}
                            onClick={() =>
                              selectedAddHotel
                                ? runTask(
                                    () =>
                                      addUserHotelPermissionAction(selectedAddHotel.id, {
                                        userId: administrator.id,
                                        hotelId: selectedAddHotel.id,
                                        role: addDraft.role,
                                      }),
                                    addKey,
                                    "Vinculo criado."
                                  )
                                : undefined
                            }
                          >
                            {pendingKey === addKey ? "Salvando..." : "Adicionar hotel"}
                          </button>
                        </div>
                      </div>
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
            );
          })}
        </div>
      )}
    </section>
  );
}
