import Link from "next/link";
import type { CSSProperties } from "react";

import type { FinanceDashboardMetrics, HotelFinanceSummary } from "@/lib/finance";

import { RevenueOverTimeChart } from "./RevenueOverTimeChart";

export type FinancePeriod = "7d" | "30d" | "month" | "year";

export const financePeriodOptions: Array<{
  value: FinancePeriod;
  label: string;
}> = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "month", label: "Este mês" },
  { value: "year", label: "Este ano" },
];

type HotelOption = {
  id: string;
  name: string;
};

type FinancialFiltersProps = {
  selectedPeriod: FinancePeriod;
  selectedHotelId?: string;
  hotels: HotelOption[];
};

type FinancialDashboardProps = {
  metrics: FinanceDashboardMetrics;
  selectedPeriod: FinancePeriod;
  selectedHotelId?: string;
  hotels: HotelOption[];
  isSuperAdmin: boolean;
};

function buildFinanceHref(period: FinancePeriod, hotelId?: string) {
  const params = new URLSearchParams({ period });

  if (hotelId) {
    params.set("hotelId", hotelId);
  }

  return `/admin/financeiro?${params.toString()}`;
}

function formatAdminDateTime(date: Date | null) {
  if (!date) {
    return "Data não informada";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatPaymentMethod(method: string | null) {
  if (!method) {
    return "Não informado";
  }

  const labels: Record<string, string> = {
    pix: "Pix",
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    boleto: "Boleto",
    ticket: "Boleto",
    account_money: "Saldo em conta",
  };

  return labels[method] ?? method.replaceAll("_", " ");
}

function EmptyFinanceState({ children }: { children: string }) {
  return <p className="admin-finance-empty">{children}</p>;
}

export function FinancialFilters({
  selectedPeriod,
  selectedHotelId,
  hotels,
}: FinancialFiltersProps) {
  return (
    <div className="finance-dashboard-filters">
      <nav className="admin-finance-periods" aria-label="Período financeiro">
        {financePeriodOptions.map((option) => (
          <Link
            key={option.value}
            href={buildFinanceHref(option.value, selectedHotelId)}
            className={
              option.value === selectedPeriod
                ? "admin-finance-period is-active"
                : "admin-finance-period"
            }
            aria-current={option.value === selectedPeriod ? "page" : undefined}
          >
            {option.label}
          </Link>
        ))}
      </nav>

      {hotels.length ? (
        <div className="finance-dashboard-hotel-filter" aria-label="Filtro por hotel">
          <Link
            href={buildFinanceHref(selectedPeriod)}
            className={!selectedHotelId ? "admin-finance-period is-active" : "admin-finance-period"}
            aria-current={!selectedHotelId ? "page" : undefined}
          >
            Todos os hotéis
          </Link>
          {hotels.map((hotel) => (
            <Link
              key={hotel.id}
              href={buildFinanceHref(selectedPeriod, hotel.id)}
              className={
                selectedHotelId === hotel.id
                  ? "admin-finance-period is-active"
                  : "admin-finance-period"
              }
              aria-current={selectedHotelId === hotel.id ? "page" : undefined}
            >
              {hotel.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function FinancialKpiCards({ metrics }: { metrics: FinanceDashboardMetrics }) {
  const cards = [
    {
      label: "Movimentação total",
      value: metrics.summary.totalMovement.formatted,
      helper: "Valor bruto pago no site.",
      variant: "primary",
    },
    {
      label: "Faturamento da plataforma",
      value: metrics.summary.platformRevenue.formatted,
      helper: "Comissão de 10% sobre pagamentos aprovados.",
      variant: "accent",
    },
    {
      label: "Repasse aos hotéis",
      value: metrics.summary.hotelNetEstimated.formatted,
      helper: "Líquido estimado de 90%.",
      variant: "neutral",
    },
    {
      label: "Transações pagas",
      value: String(metrics.summary.paidTransactionCount),
      helper: "Pagamentos confirmados no período.",
      variant: "neutral",
    },
    {
      label: "Ticket médio",
      value: metrics.summary.averageTicket.formatted,
      helper: "Média por transação paga.",
      variant: "neutral",
    },
    {
      label: "Reservas pagas",
      value: String(metrics.summary.paidTransactionCount),
      helper: "Reservas com pagamento aprovado.",
      variant: "neutral",
    },
  ];

  return (
    <div className="finance-dashboard-kpis">
      {cards.map((card) => (
        <article
          className={`hotel-content-card finance-kpi-card finance-kpi-card--${card.variant}`}
          key={card.label}
        >
          <div className="finance-kpi-card__top">
            <span>{card.label}</span>
          </div>
          <strong>{card.value}</strong>
          <p>{card.helper}</p>
        </article>
      ))}
    </div>
  );
}

export function RevenueByHotelChart({ hotels }: { hotels: HotelFinanceSummary[] }) {
  const maxHotelMovementCents = Math.max(...hotels.map((hotel) => hotel.totalMovement.cents), 1);

  return (
    <article className="hotel-content-card finance-chart-card">
      <div className="admin-finance-chart__header">
        <div>
          <h3>Movimentação por hotel</h3>
        </div>
        <p>Hotéis ordenados por valor bruto pago.</p>
      </div>

      {hotels.length ? (
        <div className="admin-finance-bars finance-bars--compact" role="list">
          {hotels.slice(0, 12).map((hotel) => {
            const width = Math.max((hotel.totalMovement.cents / maxHotelMovementCents) * 100, 3);
            const tooltip = `${hotel.hotelName}: ${hotel.totalMovement.formatted}. Comissão: ${hotel.platformRevenue.formatted}. Repasse: ${hotel.hotelNetEstimated.formatted}.`;

            return (
              <div
                className="finance-hotel-bar"
                key={hotel.hotelId}
                role="listitem"
                title={tooltip}
              >
                <div>
                  <strong>{hotel.hotelName}</strong>
                  <span>{hotel.totalMovement.formatted}</span>
                </div>
                <i aria-hidden="true">
                  <span style={{ width: `${width}%` } as CSSProperties} />
                </i>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyFinanceState>
          Ainda não há movimentações financeiras no período selecionado.
        </EmptyFinanceState>
      )}
    </article>
  );
}

export function RevenueCompositionChart({ metrics }: { metrics: FinanceDashboardMetrics }) {
  const total = Math.max(metrics.summary.totalMovement.cents, 1);
  const platformWidth = (metrics.summary.platformRevenue.cents / total) * 100;
  const hotelWidth = (metrics.summary.hotelNetEstimated.cents / total) * 100;

  return (
    <article className="hotel-content-card finance-chart-card">
      <div className="admin-finance-chart__header">
        <div>
          <h3>Comissão x repasse</h3>
        </div>
        <p>Distribuição da movimentação paga.</p>
      </div>

      {metrics.summary.paidTransactionCount ? (
        <div className="finance-composition">
          <div className="finance-composition__bar" aria-hidden="true">
            <span
              className="finance-composition__platform"
              style={{ width: `${platformWidth}%` }}
            />
            <span className="finance-composition__hotel" style={{ width: `${hotelWidth}%` }} />
          </div>
          <div className="finance-composition__legend">
            <span>
              <i className="finance-composition__dot finance-composition__dot--platform" />
              Plataforma: {metrics.summary.platformRevenue.formatted}
            </span>
            <span>
              <i className="finance-composition__dot finance-composition__dot--hotel" />
              Hotéis: {metrics.summary.hotelNetEstimated.formatted}
            </span>
          </div>
        </div>
      ) : (
        <EmptyFinanceState>
          Ainda não há movimentações financeiras no período selecionado.
        </EmptyFinanceState>
      )}
    </article>
  );
}

export function PaymentMethodsChart({ metrics }: { metrics: FinanceDashboardMetrics }) {
  const maxValue = Math.max(
    ...metrics.paymentMethods.map((method) => method.totalMovement.cents),
    1
  );

  return (
    <article className="hotel-content-card finance-chart-card">
      <div className="admin-finance-chart__header">
        <div>
          <h3>Por método</h3>
        </div>
        <p>Valor movimentado por forma de pagamento.</p>
      </div>

      {metrics.paymentMethods.length ? (
        <div className="finance-method-list">
          {metrics.paymentMethods.map((method) => {
            const width = Math.max((method.totalMovement.cents / maxValue) * 100, 3);

            return (
              <div className="finance-method-row" key={method.method}>
                <div>
                  <strong>{method.label}</strong>
                </div>
                <i aria-hidden="true">
                  <span style={{ width: `${width}%` } as CSSProperties} />
                </i>
                <b>{method.totalMovement.formatted}</b>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyFinanceState>
          Ainda não há movimentações financeiras no período selecionado.
        </EmptyFinanceState>
      )}
    </article>
  );
}

export function HotelFinancialRanking({ hotels }: { hotels: HotelFinanceSummary[] }) {
  return (
    <article className="hotel-content-card admin-finance-table-card">
      <div className="admin-finance-chart__header">
        <div>
          <h3>Hotéis por movimentação</h3>
        </div>
        <p>Resumo financeiro por hotel.</p>
      </div>

      {hotels.length ? (
        <div className="admin-finance-table-wrap">
          <table className="admin-finance-table">
            <thead>
              <tr>
                <th scope="col">Hotel</th>
                <th scope="col">Movimentação bruta</th>
                <th scope="col">Comissão</th>
                <th scope="col">Repasse estimado</th>
                <th scope="col">Transações</th>
              </tr>
            </thead>
            <tbody>
              {hotels.map((hotel) => (
                <tr key={hotel.hotelId}>
                  <th scope="row">{hotel.hotelName}</th>
                  <td>{hotel.totalMovement.formatted}</td>
                  <td>{hotel.platformRevenue.formatted}</td>
                  <td>{hotel.hotelNetEstimated.formatted}</td>
                  <td>{hotel.transactionCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyFinanceState>
          Nenhuma movimentação financeira confirmada no período.
        </EmptyFinanceState>
      )}
    </article>
  );
}

export function RecentTransactionsList({ metrics }: { metrics: FinanceDashboardMetrics }) {
  return (
    <article className="hotel-content-card admin-finance-table-card admin-finance-table-card--recent">
      <div className="admin-finance-chart__header">
        <div>
          <h3>Movimentações recentes</h3>
        </div>
        <p>Últimas reservas pagas do site dentro do seu escopo.</p>
      </div>

      {metrics.recentTransactions.length ? (
        <div className="finance-recent-list">
          {metrics.recentTransactions.map((transaction) => (
            <article className="finance-recent-item" key={transaction.id}>
              <div className="finance-recent-item__header">
                <span>{formatAdminDateTime(transaction.paidAt ?? transaction.createdAt)}</span>
                <span className="admin-finance-status">Pago</span>
              </div>
              <strong>{transaction.hotelName}</strong>
              <p>
                {transaction.roomName} · {transaction.guestName}
              </p>
              <dl>
                <div>
                  <dt>Método</dt>
                  <dd>{formatPaymentMethod(transaction.paymentMethod)}</dd>
                </div>
                <div>
                  <dt>Valor bruto</dt>
                  <dd>{transaction.totalMovement.formatted}</dd>
                </div>
                <div>
                  <dt>Comissão</dt>
                  <dd>{transaction.platformRevenue.formatted}</dd>
                </div>
                <div>
                  <dt>Líquido hotel</dt>
                  <dd>{transaction.hotelNetEstimated.formatted}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      ) : (
        <EmptyFinanceState>
          Nenhuma movimentação financeira confirmada no período.
        </EmptyFinanceState>
      )}
    </article>
  );
}

export function FinancialDashboard({
  metrics,
  selectedPeriod,
  selectedHotelId,
  hotels,
  isSuperAdmin,
}: FinancialDashboardProps) {
  return (
    <section className="section admin-section finance-dashboard-page">
      <div className="finance-dashboard-hero">
        <div>
          <h1>Dashboard financeiro</h1>
          <p>Acompanhe movimentação paga, comissão da plataforma e repasses estimados por hotel.</p>
        </div>
        <p className="finance-dashboard-scope">
          {isSuperAdmin ? "Visão consolidada da rede" : "Visão limitada aos seus hotéis"}
        </p>
      </div>

      <FinancialFilters
        selectedPeriod={selectedPeriod}
        selectedHotelId={selectedHotelId}
        hotels={hotels}
      />

      {metrics.containsTestData ? (
        <div className="finance-dashboard-test-warning" role="status">
          Este painel contém movimentações financeiras de teste.
        </div>
      ) : null}

      <FinancialKpiCards metrics={metrics} />

      <div className="finance-dashboard-charts">
        <RevenueOverTimeChart metrics={metrics} />
        <RevenueCompositionChart metrics={metrics} />
        <RevenueByHotelChart hotels={metrics.byHotel} />
      </div>

      <div className="finance-dashboard-analytics">
        <RecentTransactionsList metrics={metrics} />
      </div>
    </section>
  );
}
