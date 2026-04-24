import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/LoginForm";
import { getAuthSession } from "@/lib/auth/session";

export default async function LoginPage() {
  const session = await getAuthSession();

  if (session) {
    redirect("/");
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
          </div>
        </section>
      </main>
    </div>
  );
}
