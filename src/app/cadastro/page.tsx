import Link from "next/link";

import { CadastroForm } from "./CadastroForm";

export default function CadastroPage() {
  return (
    <div className="page-shell">
      <main className="auth-page">
        <section className="section auth-section">
          <div className="auth-card">
            <span className="hotel-page-eyebrow">Cadastro</span>
            <h1>Criar conta</h1>
            <p className="auth-copy">Informe seus dados para iniciar o acesso à plataforma LPH.</p>

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
