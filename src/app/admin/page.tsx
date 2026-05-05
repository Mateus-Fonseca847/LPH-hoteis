import Link from "next/link";
import type { CSSProperties } from "react";

import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { getFinanceDashboardMetrics, type FinanceDashboardFilters } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

import { AdminAccessDenied } from "./AdminAccessDenied";

function formatRole(role: string) {
  return role === "super_admin" ? "Super admin" : "Admin de hotel";
}

type AdminHomePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

type FinancePeriod = "7d" | "30d" | "month" | "year";

const financePeriodOptions: Array<{
  value: FinancePeriod;
  label: string;
}> = [
  { value: "7d", label: "Últimos 7 dias" },
  { value: "30d", label: "Últimos 30 dias" },
  { value: "month", label: "Este mês" },
  { value: "year", label: "Este ano" },
];

function getSearchParam(searchParams: Record<string, string | string[] | undefined>, key: string) {
  const value = searchParams[key];

  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parseFinancePeriod(value: string): FinancePeriod {
  return financePeriodOptions.some((option) => option.value === value)
    ? (value as FinancePeriod)
    : "30d";
}

function getFinancePeriodFilters(period: FinancePeriod, now = new Date()): FinanceDashboardFilters {
  const from = new Date(now);

  if (period === "7d") {
    from.setDate(now.getDate() - 7);
    return { from };
  }

  if (period === "month") {
    return { from: new Date(now.getFullYear(), now.getMonth(), 1) };
  }

  if (period === "year") {
    return { from: new Date(now.getFullYear(), 0, 1) };
  }

  from.setDate(now.getDate() - 30);
  return { from };
}

function getFinancePeriodLabel(period: FinancePeriod) {
  return financePeriodOptions.find((option) => option.value === period)?.label ?? "Últimos 30 dias";
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

export default async function AdminHomePage({ searchParams }: AdminHomePageProps) {
  let user;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedFinancePeriod = parseFinancePeriod(getSearchParam(resolvedSearchParams, "period"));
  const financeFilters = {
    ...getFinancePeriodFilters(selectedFinancePeriod),
    recentLimit: 10,
  };

  try {
    user = await requireAdminRouteSession("/admin");
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  const hotelPermissions =
    user.globalRole === "super_admin"
      ? []
      : await prisma.hotelPermission.findMany({
          where: {
            userId: user.id,
          },
          select: {
            hotelId: true,
          },
        });

  const scopedHotelIds =
    user.globalRole === "super_admin"
      ? null
      : Array.from(new Set(hotelPermissions.map((permission) => permission.hotelId)));
  const hotelScope = scopedHotelIds === null ? {} : { id: { in: scopedHotelIds } };

  const [totalHotels, publishedHotels] = await prisma.$transaction([
    prisma.hotel.count({
      where: hotelScope,
    }),
    prisma.hotel.count({
      where: {
        ...hotelScope,
        isPublished: true,
      },
    }),
  ]);

  const isSuperAdmin = user.globalRole === "super_admin";
  const financeMetrics = await getFinanceDashboardMetrics(user, financeFilters);
  const financePeriodLabel = getFinancePeriodLabel(selectedFinancePeriod);
  const maxHotelMovementCents = Math.max(
    ...financeMetrics.byHotel.map((hotel) => hotel.totalMovement.cents),
    1
  );
  const scopedAdminHotelIds = scopedHotelIds ?? [];
  const activeAdmins = isSuperAdmin
    ? await prisma.user.count({
        where: {
          isActive: true,
          globalRole: {
            in: ["super_admin", "hotel_admin"],
          },
        },
      })
    : scopedAdminHotelIds.length
      ? await prisma.user.count({
          where: {
            isActive: true,
            globalRole: "hotel_admin",
            hotelPermissions: {
              some: {
                hotelId: {
                  in: scopedAdminHotelIds,
                },
              },
            },
          },
        })
      : 0;

  return (
    <section className="section admin-section">
      <div className="section-heading admin-section-heading">
        <span className="hotel-page-eyebrow">Admin</span>
        <h1>Painel operacional</h1>
        <p className="admin-rooms-copy">
          {isSuperAdmin
            ? "Visão consolidada da rede LPH."
            : "Visão limitada aos hotéis vinculados ao seu usuário."}
        </p>
      </div>

      <div className="admin-dashboard-hero">
        <article className="hotel-content-card admin-dashboard-profile">
          <span>Perfil</span>
          <strong>{user.name}</strong>
          <p>{user.email}</p>
          <small>{formatRole(user.globalRole)}</small>
        </article>

        <Link
          href="/admin/hoteis"
          className="hotel-content-card admin-overview-card admin-link-card"
        >
          <span>Hotéis</span>
          <strong>Gerenciar unidades</strong>
          <p>Editar perfis, quartos, tarifas e disponibilidade.</p>
        </Link>

        <Link
          href="/admin/auditoria"
          className="hotel-content-card admin-overview-card admin-link-card"
        >
          <span>Auditoria</span>
          <strong>Ver registros</strong>
          <p>Consultar histórico administrativo dentro do seu escopo.</p>
        </Link>

        <Link
          href="#admin-finance"
          className="hotel-content-card admin-overview-card admin-link-card"
        >
          <span>FINANCEIRO</span>
          <strong>Movimentações</strong>
          <p>Acompanhe reservas pagas, receita da plataforma e repasses por hotel.</p>
          <small>Ver dashboard financeiro</small>
        </Link>
      </div>

      <div className="admin-dashboard-metrics">
        <article className="hotel-content-card admin-dashboard-metric">
          <span>{isSuperAdmin ? "Total de hotéis" : "Hotéis acessíveis"}</span>
          <strong>{totalHotels}</strong>
          <p>
            {isSuperAdmin ? "Unidades cadastradas na rede." : "Unidades vinculadas ao seu usuário."}
          </p>
        </article>

        <article className="hotel-content-card admin-dashboard-metric">
          <span>Publicados</span>
          <strong>{publishedHotels}</strong>
          <p>
            {isSuperAdmin
              ? "Hotéis visíveis no site público."
              : "Hotéis do seu escopo visíveis no site público."}
          </p>
        </article>

        <article className="hotel-content-card admin-dashboard-metric">
          <span>Admins ativos</span>
          <strong>{activeAdmins}</strong>
          <p>Usuários administrativos ativos.</p>
        </article>
      </div>

      <section
        className="admin-finance-section"
        id="admin-finance"
        aria-labelledby="admin-finance-title"
      >
        <div className="admin-finance-header">
          <div className="section-heading admin-subsection-heading">
            <span className="hotel-page-eyebrow">Financeiro</span>
            <h2 id="admin-finance-title">Indicadores financeiros</h2>
            <p className="admin-rooms-copy">
              Considera somente reservas com pagamento aprovado dentro do seu escopo.
            </p>
          </div>

          <nav className="admin-finance-periods" aria-label="Período financeiro">
            {financePeriodOptions.map((option) => (
              <Link
                key={option.value}
                href={`/admin?period=${option.value}#admin-finance`}
                className={
                  option.value === selectedFinancePeriod
                    ? "admin-finance-period is-active"
                    : "admin-finance-period"
                }
                aria-current={option.value === selectedFinancePeriod ? "page" : undefined}
              >
                {option.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="admin-finance-grid">
          <article className="hotel-content-card admin-dashboard-metric admin-finance-metric admin-finance-metric--wide">
            <span>Movimentação total do site</span>
            <strong>{financeMetrics.summary.totalMovement.formatted}</strong>
            <p>Reservas pagas no período analisado.</p>
          </article>

          <article className="hotel-content-card admin-dashboard-metric admin-finance-metric">
            <span>Faturamento da plataforma</span>
            <strong>{financeMetrics.summary.platformRevenue.formatted}</strong>
            <p>Comissão de 10% sobre movimentações pagas.</p>
          </article>

          <article className="hotel-content-card admin-dashboard-metric admin-finance-metric">
            <span>Valor estimado aos hotéis</span>
            <strong>{financeMetrics.summary.hotelNetEstimated.formatted}</strong>
            <p>Repasse estimado de 90% da movimentação.</p>
          </article>

          <article className="hotel-content-card admin-dashboard-metric admin-finance-metric">
            <span>Transações pagas</span>
            <strong>{financeMetrics.summary.paidTransactionCount}</strong>
            <p>Pagamentos aprovados considerados no cálculo.</p>
          </article>

          <article className="hotel-content-card admin-dashboard-metric admin-finance-metric">
            <span>Ticket médio</span>
            <strong>{financeMetrics.summary.averageTicket.formatted}</strong>
            <p>Movimentação média por transação paga.</p>
          </article>

          <article className="hotel-content-card admin-dashboard-metric admin-finance-metric">
            <span>Período analisado</span>
            <strong>{financePeriodLabel}</strong>
            <p>
              {isSuperAdmin
                ? "Visão consolidada da rede."
                : "Somente hotéis vinculados à sua conta."}
            </p>
          </article>
        </div>

        <article
          className="hotel-content-card admin-finance-chart"
          aria-labelledby="admin-finance-hotel-chart-title"
        >
          <div className="admin-finance-chart__header">
            <div>
              <span className="hotel-page-eyebrow">Hotéis</span>
              <h3 id="admin-finance-hotel-chart-title">Movimentação por hotel</h3>
            </div>
            <p>Valor total pago por hotel, do maior para o menor.</p>
          </div>

          {financeMetrics.byHotel.length ? (
            <div className="admin-finance-bars" role="list">
              {financeMetrics.byHotel.map((hotel) => {
                const width = Math.max(
                  (hotel.totalMovement.cents / maxHotelMovementCents) * 100,
                  3
                );
                const tooltip = `${hotel.hotelName}: ${hotel.totalMovement.formatted}. Comissão da plataforma: ${hotel.platformRevenue.formatted}. Líquido estimado do hotel: ${hotel.hotelNetEstimated.formatted}.`;

                return (
                  <div
                    className="admin-finance-bar-row"
                    key={hotel.hotelId}
                    role="listitem"
                    title={tooltip}
                  >
                    <div className="admin-finance-bar-row__meta">
                      <strong>{hotel.hotelName}</strong>
                      <span>{hotel.transactionCount} transação(ões) paga(s)</span>
                    </div>
                    <div
                      className="admin-finance-bar"
                      aria-label={`${hotel.hotelName}: ${hotel.totalMovement.formatted}`}
                    >
                      <span style={{ width: `${width}%` } as CSSProperties} />
                    </div>
                    <dl className="admin-finance-bar-row__values">
                      <div>
                        <dt>Movimentação</dt>
                        <dd>{hotel.totalMovement.formatted}</dd>
                      </div>
                      <div>
                        <dt>Comissão</dt>
                        <dd>{hotel.platformRevenue.formatted}</dd>
                      </div>
                      <div>
                        <dt>Líquido hotel</dt>
                        <dd>{hotel.hotelNetEstimated.formatted}</dd>
                      </div>
                    </dl>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="admin-finance-empty">
              Nenhuma movimentação paga encontrada para o período selecionado.
            </p>
          )}
        </article>

        <article
          className="hotel-content-card admin-finance-table-card"
          aria-labelledby="admin-finance-hotel-table-title"
        >
          <div className="admin-finance-chart__header">
            <div>
              <span className="hotel-page-eyebrow">Comissão</span>
              <h3 id="admin-finance-hotel-table-title">Comissão por hotel</h3>
            </div>
            <p>
              Detalhamento da movimentação bruta, comissão da plataforma e valor estimado do hotel.
            </p>
          </div>

          {financeMetrics.byHotel.length ? (
            <div className="admin-finance-table-wrap">
              <table className="admin-finance-table">
                <thead>
                  <tr>
                    <th scope="col">Hotel</th>
                    <th scope="col">Movimentação bruta</th>
                    <th scope="col">Comissão da plataforma</th>
                    <th scope="col">Líquido estimado do hotel</th>
                    <th scope="col">Transações pagas</th>
                  </tr>
                </thead>
                <tbody>
                  {financeMetrics.byHotel.map((hotel) => (
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
            <p className="admin-finance-empty">
              Nenhuma movimentação financeira confirmada no período.
            </p>
          )}
        </article>

        <article
          className="hotel-content-card admin-finance-table-card"
          aria-labelledby="admin-finance-recent-title"
        >
          <div className="admin-finance-chart__header">
            <div>
              <span className="hotel-page-eyebrow">Recentes</span>
              <h3 id="admin-finance-recent-title">Movimentações recentes</h3>
            </div>
            <p>Últimas reservas pagas do site dentro do seu escopo.</p>
          </div>

          {financeMetrics.recentTransactions.length ? (
            <div className="admin-finance-table-wrap">
              <table className="admin-finance-table admin-finance-table--recent">
                <thead>
                  <tr>
                    <th scope="col">Data</th>
                    <th scope="col">Hotel</th>
                    <th scope="col">Quarto</th>
                    <th scope="col">Hóspede</th>
                    <th scope="col">Método</th>
                    <th scope="col">Status</th>
                    <th scope="col">Valor bruto</th>
                    <th scope="col">Comissão</th>
                    <th scope="col">Líquido hotel</th>
                  </tr>
                </thead>
                <tbody>
                  {financeMetrics.recentTransactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td>{formatAdminDateTime(transaction.paidAt ?? transaction.createdAt)}</td>
                      <th scope="row">{transaction.hotelName}</th>
                      <td>{transaction.roomName}</td>
                      <td>{transaction.guestName}</td>
                      <td>{formatPaymentMethod(transaction.paymentMethod)}</td>
                      <td>
                        <span className="admin-finance-status">Pago</span>
                      </td>
                      <td>{transaction.totalMovement.formatted}</td>
                      <td>{transaction.platformRevenue.formatted}</td>
                      <td>{transaction.hotelNetEstimated.formatted}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="admin-finance-empty">
              Nenhuma movimentação financeira confirmada no período.
            </p>
          )}
        </article>
      </section>
    </section>
  );
}
