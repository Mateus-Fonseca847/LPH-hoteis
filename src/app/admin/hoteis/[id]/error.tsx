"use client";

import Link from "next/link";

export default function AdminHotelEditErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="page-shell">
      <section className="section admin-section">
        <div className="hotel-empty-state" role="alert">
          <strong>Não foi possível carregar este hotel.</strong>
          <p>
            Tente novamente. Se o problema continuar, verifique os logs do servidor em
            [admin/hoteis/edit/load].
          </p>
          <div className="hotel-error-actions">
            <button type="button" className="card-cta-button" onClick={reset}>
              Tentar novamente
            </button>
            <Link href="/admin/hoteis" className="admin-secondary-button">
              Voltar para hotéis
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
