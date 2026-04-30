import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AccountSecurityForm } from "@/app/admin/seguranca/AccountSecurityForm";
import { AdminAccessError, isAdminUser, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatSecurityStatus(enabled: boolean, isAdmin: boolean) {
  if (enabled) {
    return "Ativo";
  }

  return isAdmin ? "Ativacao pendente" : "Inativo";
}

export default async function AdminSecurityPage() {
  let sessionUser;

  try {
    sessionUser = await requireAdminRouteSession("/admin/seguranca");
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  const user = await prisma.user.findUnique({
    where: {
      id: sessionUser.id,
      isActive: true,
    },
    select: {
      name: true,
      email: true,
      globalRole: true,
      emailTwoFactorEnabled: true,
    },
  });

  if (!user) {
    return <AdminAccessDenied />;
  }

  const isAdmin = isAdminUser(user.globalRole);
  const status = formatSecurityStatus(user.emailTwoFactorEnabled, isAdmin);

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Seguranca</span>
        <h1>Seguranca da conta</h1>
        <p className="admin-rooms-copy">
          Configure a verificacao em duas etapas por e-mail para proteger acessos administrativos.
        </p>
      </div>

      <div className="admin-overview-grid admin-security-grid">
        <article className="hotel-content-card admin-overview-card">
          <span>Status atual</span>
          <strong>{status}</strong>
          <p>
            {user.emailTwoFactorEnabled
              ? "Sua conta está marcada para usar código por e-mail."
              : "Ative o 2FA por e-mail para manter sua conta alinhada à política administrativa."}
          </p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Conta</span>
          <strong>{user.name}</strong>
          <p>{user.email}</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Política</span>
          <strong>{isAdmin ? "Obrigatório para admins" : "Opcional"}</strong>
          <p>
            {isAdmin
              ? "Admins precisam validar o código enviado por e-mail antes de acessar o painel."
              : "Usuários comuns podem usar 2FA como camada adicional quando disponível."}
          </p>
        </article>
      </div>

      <article className="admin-form-section admin-security-panel">
        <div className="section-heading admin-subsection-heading">
          <h2>2FA por e-mail</h2>
          <p className="admin-rooms-copy">
            Nenhum código ou segredo é exibido nesta área. As alterações administrativas são
            registradas em auditoria.
          </p>
        </div>

        <AccountSecurityForm emailTwoFactorEnabled={user.emailTwoFactorEnabled} isAdmin={isAdmin} />
      </article>
    </section>
  );
}
