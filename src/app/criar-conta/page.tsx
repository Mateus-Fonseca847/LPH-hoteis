import type { Metadata } from "next";
import Link from "next/link";

import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Criar conta",
  description: "Crie sua conta de usuÃ¡rio na LPH HotÃ©is com e-mail e senha.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignupPage() {
  return (
    <div className="page-shell">
      <main className="auth-page">
        <section className="section auth-section">
          <div className="auth-card">
            <h1>Criar conta</h1>
            <p className="auth-copy">
              Cadastre-se com e-mail e senha para acessar sua Ã¡rea de usuÃ¡rio.
            </p>

            <SignupForm />

            <p className="auth-footer-link">
              JÃ¡ tenho conta{" "}
              <Link href="/login" className="auth-inline-link">
                Entrar
              </Link>
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
