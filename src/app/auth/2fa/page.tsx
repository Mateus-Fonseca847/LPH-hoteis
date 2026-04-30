import { redirect } from "next/navigation";

import { isAdminUser, isFullyAuthenticatedSession } from "@/lib/auth";
import { normalizeRedirectTarget } from "@/lib/auth/redirect";
import { getAuthSession } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

import { TwoFactorEmailForm } from "./TwoFactorEmailForm";

export const dynamic = "force-dynamic";

type TwoFactorPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function getSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function maskEmail(email: string) {
  const [localPart = "", domain = ""] = email.split("@");
  const visibleStart = localPart.slice(0, 2);
  const visibleEnd = localPart.length > 4 ? localPart.slice(-1) : "";

  return `${visibleStart || "**"}***${visibleEnd}@${domain || "dominio"}`;
}

export default async function TwoFactorPage({ searchParams }: TwoFactorPageProps) {
  const session = await getAuthSession();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const redirectTo = normalizeRedirectTarget(getSearchParam(resolvedSearchParams, "redirectTo"));

  if (isFullyAuthenticatedSession(session)) {
    redirect(redirectTo);
  }

  if (
    !session?.sub ||
    session.twoFactorVerified ||
    session.twoFactorSetupRequired ||
    !isAdminUser(session.globalRole as "super_admin" | "hotel_admin" | "user")
  ) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  const user = await prisma.user.findUnique({
    where: {
      id: session.sub,
      isActive: true,
    },
    select: {
      email: true,
    },
  });

  if (!user) {
    redirect(`/login?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return (
    <div className="page-shell">
      <main className="auth-page">
        <section className="section auth-section">
          <div className="auth-card">
            <span className="hotel-page-eyebrow">Acesso seguro</span>
            <h1>Verificação em duas etapas</h1>
            <p className="auth-copy">
              Enviamos um código de segurança para {maskEmail(user.email)}. Informe o código para
              concluir o acesso ao painel administrativo.
            </p>
            <TwoFactorEmailForm redirectTo={redirectTo} />
          </div>
        </section>
      </main>
    </div>
  );
}
