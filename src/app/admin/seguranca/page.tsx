import { AdminAccessDenied } from "@/app/admin/AdminAccessDenied";
import { AccountSecurityForm } from "@/app/admin/seguranca/AccountSecurityForm";
import { AdminAccessError, isAdminUser, requireAdminRouteSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function formatSecurityStatus(enabled: boolean) {
  if (enabled) {
    return "Ativo";
  }

  return "Inativo";
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
  const status = formatSecurityStatus(user.emailTwoFactorEnabled);

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <h1>Segurança da conta</h1>
        <p className="admin-rooms-copy">
          Configure a verificação em duas etapas por e-mail para proteger acessos administrativos.
        </p>
      </div>

      <div className="admin-overview-grid admin-security-grid">
        <article className="hotel-content-card admin-overview-card">
          <span>Status atual</span>
          <strong>{status}</strong>
          <p>
            {user.emailTwoFactorEnabled
              ? "Sua conta está marcada para usar código por e-mail."
              : "Você pode ativar o 2FA por e-mail como camada adicional de segurança."}
          </p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Conta</span>
          <strong>{user.name}</strong>
          <p>{user.email}</p>
        </article>

        <article className="hotel-content-card admin-overview-card">
          <span>Política</span>
          <strong>Opcional</strong>
          <p>
            {isAdmin
              ? "Admins podem acessar com e-mail e senha. Quando o 2FA estiver ativo, o código por e-mail será solicitado."
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
