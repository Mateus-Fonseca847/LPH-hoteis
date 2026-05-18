"use client";

import Link from "next/link";

export default function PublicErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell">
      <section className="section">
        <div className="hotel-empty-state" role="alert">
          <strong>Não foi possível carregar a consulta.</strong>
          <p>
            Tente novamente. Se o problema continuar, fale com a equipe LPH para consultar hotéis e
            disponibilidade.
          </p>
          <div className="hotel-error-actions">
            <button type="button" className="card-cta-button" onClick={reset}>
              Tentar novamente
            </button>
            <Link href="/" className="admin-secondary-button">
              Voltar para a home
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
