import type { Metadata } from "next";
import Link from "next/link";

import { ResetPasswordForm } from "@/app/redefinir-senha/ResetPasswordForm";

type ResetPasswordPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export const metadata: Metadata = {
  title: "Redefinir senha",
  description: "Crie uma nova senha para sua conta LPH Hotéis.",
  robots: {
    index: false,
    follow: false,
  },
};

function getSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const token = getSearchParam(resolvedSearchParams, "token");

  return (
    <div className="page-shell">
      <main className="auth-page">
        <section className="section auth-section">
          <div className="auth-card">
            <h1>Redefinir senha</h1>
            <p className="auth-copy">Crie uma nova senha para acessar sua conta.</p>
            <ResetPasswordForm token={token} />
            <div className="auth-footer-link">
              <Link href="/login" className="auth-inline-link">
                Voltar ao login
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
