export function StayDetailsSection() {
  return (
    <section id="details" className="details section reveal">
      <div className="details-heading">
        <h2>Cuidamos de cada detalhe da sua estadia</h2>
      </div>

      <div className="details-grid">
        <article className="detail-card reveal">
          <h3>Hospedagens selecionadas</h3>
          <p>
            Hotéis escolhidos com conforto, personalidade local e padrão de qualidade confiável.
          </p>
        </article>

        <article className="detail-card image-card reveal">
          <img
            src="https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=900&q=80"
            alt="Piscina de hotel com palmeiras"
          />
        </article>

        <article className="detail-card reveal dark-panel">
          <h3>Atendimento dedicado</h3>
          <p>
            Da reserva à chegada, nossa equipe ajuda com traslados, horários e solicitações
            especiais.
          </p>
        </article>

        <article className="detail-card reveal">
          <h3>Planejamento flexível</h3>
          <p>
            Pacotes ideais para lazer, viagens em família e finais de semana prolongados
            inesquecíveis.
          </p>
        </article>
      </div>
    </section>
  );
}
