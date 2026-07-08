import type { Metadata } from "next";
import Link from "next/link";

import { CadastroForm } from "./CadastroForm";

export const metadata: Metadata = {
  title: "Solicitar acesso",
  description: "Solicite acesso administrativo para cadastrar seu hotel na LPH Hotéis.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function CadastroPage() {
  return (
    <div className="page-shell">
      <main className="auth-page">
        <section className="section auth-section">
          <div className="auth-card">
            <h1>Solicitar acesso de hotel</h1>
            <p className="auth-copy">
              Envie os dados do responsável e do hotel para análise da equipe LPH.
            </p>

            <CadastroForm />

            <p className="auth-footer-link">
              Já tenho conta{" "}
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
