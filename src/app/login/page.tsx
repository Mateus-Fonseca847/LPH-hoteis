import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/LoginForm";
import { isFullyAuthenticatedSession } from "@/lib/auth";
import { normalizeRedirectTarget } from "@/lib/auth/redirect";
import { getAuthSession } from "@/lib/auth/session";

type LoginPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Entrar",
  description: "Acesse sua conta LPH Hotéis com e-mail e senha.",
  robots: {
    index: false,
    follow: false,
  },
};

function getSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await getAuthSession();
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const redirectTo = normalizeRedirectTarget(getSearchParam(resolvedSearchParams, "redirectTo"));

  if (isFullyAuthenticatedSession(session)) {
    redirect(redirectTo);
  }

  if (session?.sub && !session.twoFactorVerified) {
    redirect(`/auth/2fa?redirectTo=${encodeURIComponent(redirectTo)}`);
  }

  return (
    <div className="page-shell">
      <main className="auth-page">
        <section className="section auth-section">
          <div className="auth-card">
            <span className="hotel-page-eyebrow">Acesso</span>
            <h1>Login centralizado</h1>
            <p className="auth-copy">
              Entre com e-mail e senha para acessar a área autenticada da plataforma.
            </p>
            <LoginForm />
            <p className="auth-footer-link">
              Ainda não tenho conta{" "}
              <Link href="/cadastro" className="auth-inline-link">
                Criar conta
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
