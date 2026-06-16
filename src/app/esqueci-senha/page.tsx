import type { Metadata } from "next";
import Link from "next/link";

import { ForgotPasswordForm } from "@/app/esqueci-senha/ForgotPasswordForm";

export const metadata: Metadata = {
  title: "Esqueci minha senha",
  description: "Solicite instruções para redefinir sua senha na LPH Hotéis.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ForgotPasswordPage() {
  return (
    <div className="page-shell">
      <main className="auth-page">
        <section className="section auth-section">
          <div className="auth-card">
            <h1>Esqueci minha senha</h1>
            <p className="auth-copy">
              Informe seu e-mail para receber instruções de redefinição de senha.
            </p>
            <ForgotPasswordForm />
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
