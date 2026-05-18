import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="page-shell">
      <section className="section">
        <div className="hotel-empty-state">
          <strong>Hotel não encontrado.</strong>
          <p>O hotel pode estar indisponível, despublicado ou com o endereço incorreto.</p>
          <div className="hotel-error-actions">
            <Link href="/#journey" className="card-cta-button">
              Ver hotéis publicados
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
