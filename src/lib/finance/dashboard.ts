import type { GlobalRole, Prisma } from "@prisma/client";

import { AuthorizationError } from "@/lib/errors/app-error";
import { prisma } from "@/lib/prisma";
import { formatPriceInBRL } from "@/lib/stay-query";

const DEFAULT_RECENT_LIMIT = 8;
const MAX_RECENT_LIMIT = 30;

export type FinanceDashboardActor = {
  id: string;
  globalRole: GlobalRole;
};

export type FinanceDashboardFilters = {
  from?: Date;
  to?: Date;
  hotelId?: string;
  recentLimit?: number;
};

export type FinanceAmount = {
  cents: number;
  formatted: string;
};

export type HotelFinanceSummary = {
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  transactionCount: number;
  totalMovement: FinanceAmount;
  platformRevenue: FinanceAmount;
  hotelNetEstimated: FinanceAmount;
  averageTicket: FinanceAmount;
};

export type RecentFinancialTransaction = {
  id: string;
  reservationId: string;
  hotelId: string;
  hotelName: string;
  hotelSlug: string;
  roomName: string;
  guestName: string;
  provider: string;
  paymentMethod: string | null;
  status: "paid";
  paidAt: Date | null;
  createdAt: Date;
  totalMovement: FinanceAmount;
  platformRevenue: FinanceAmount;
  hotelNetEstimated: FinanceAmount;
};

export type FinanceTrendPoint = {
  key: string;
  label: string;
  totalMovement: FinanceAmount;
  platformRevenue: FinanceAmount;
  hotelNetEstimated: FinanceAmount;
  transactionCount: number;
};

export type PaymentMethodSummary = {
  method: string;
  label: string;
  transactionCount: number;
  totalMovement: FinanceAmount;
};

export type FinanceDashboardMetrics = {
  scope: {
    type: "network" | "hotels";
    hotelIds: string[] | null;
  };
  summary: {
    totalMovement: FinanceAmount;
    platformRevenue: FinanceAmount;
    hotelNetEstimated: FinanceAmount;
    paidTransactionCount: number;
    averageTicket: FinanceAmount;
  };
  byHotel: HotelFinanceSummary[];
  recentTransactions: RecentFinancialTransaction[];
  trend: FinanceTrendPoint[];
  paymentMethods: PaymentMethodSummary[];
  containsTestData: boolean;
};

type FinanceScope =
  | {
      type: "network";
      hotelIds: null;
    }
  | {
      type: "hotels";
      hotelIds: string[];
    };

export function formatFinanceAmountInBRL(cents: number) {
  return formatPriceInBRL(cents);
}

export function toFinanceAmount(cents: number): FinanceAmount {
  return {
    cents,
    formatted: formatFinanceAmountInBRL(cents),
  };
}

function getRecentLimit(limit?: number) {
  if (!Number.isInteger(limit) || !limit) {
    return DEFAULT_RECENT_LIMIT;
  }

  return Math.min(Math.max(limit, 1), MAX_RECENT_LIMIT);
}

async function resolveFinanceScope(actor: FinanceDashboardActor): Promise<FinanceScope> {
  if (actor.globalRole === "super_admin") {
    return {
      type: "network",
      hotelIds: null,
    };
  }

  if (actor.globalRole !== "hotel_admin") {
    throw new AuthorizationError();
  }

  const permissions = await prisma.hotelPermission.findMany({
    where: {
      userId: actor.id,
    },
    select: {
      hotelId: true,
    },
  });

  return {
    type: "hotels",
    hotelIds: Array.from(new Set(permissions.map((permission) => permission.hotelId))),
  };
}

function buildPaidTransactionsWhere(
  scope: FinanceScope,
  filters: FinanceDashboardFilters
): Prisma.PaymentTransactionWhereInput | null {
  if (scope.type === "hotels" && scope.hotelIds.length === 0) {
    return null;
  }

  if (filters.hotelId && scope.type === "hotels" && !scope.hotelIds.includes(filters.hotelId)) {
    throw new AuthorizationError();
  }

  return {
    status: "paid",
    ...(filters.hotelId
      ? {
          hotelId: filters.hotelId,
        }
      : scope.type === "hotels"
        ? {
            hotelId: {
              in: scope.hotelIds,
            },
          }
        : {}),
    ...(filters.from || filters.to
      ? {
          paidAt: {
            ...(filters.from ? { gte: filters.from } : {}),
            ...(filters.to ? { lte: filters.to } : {}),
          },
        }
      : {}),
  };
}

function getAverageTicketCents(totalMovementCents: number, transactionCount: number) {
  return transactionCount > 0 ? Math.floor(totalMovementCents / transactionCount) : 0;
}

function getTrendKey(date: Date, filters: FinanceDashboardFilters) {
  const useMonth = filters.from
    ? date.getTime() - filters.from.getTime() > 1000 * 60 * 60 * 24 * 120
    : false;

  if (useMonth) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  return date.toISOString().slice(0, 10);
}

function formatTrendLabel(key: string) {
  if (key.length === 7) {
    const [year, month] = key.split("-").map(Number);

    return new Intl.DateTimeFormat("pt-BR", {
      month: "short",
      year: "2-digit",
    }).format(new Date(year, month - 1, 1));
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${key}T00:00:00`));
}

function formatPaymentMethodLabel(method: string) {
  const labels: Record<string, string> = {
    pix: "Pix",
    credit_card: "Crédito",
    debit_card: "Débito",
    boleto: "Boleto",
    ticket: "Boleto",
    account_money: "Saldo em conta",
    unknown: "Não informado",
  };

  return labels[method] ?? method.replaceAll("_", " ");
}

function emptyFinanceDashboard(scope: FinanceScope): FinanceDashboardMetrics {
  return {
    scope,
    summary: {
      totalMovement: toFinanceAmount(0),
      platformRevenue: toFinanceAmount(0),
      hotelNetEstimated: toFinanceAmount(0),
      paidTransactionCount: 0,
      averageTicket: toFinanceAmount(0),
    },
    byHotel: [],
    recentTransactions: [],
    trend: [],
    paymentMethods: [],
    containsTestData: false,
  };
}

export async function getFinanceDashboardMetrics(
  actor: FinanceDashboardActor,
  filters: FinanceDashboardFilters = {}
): Promise<FinanceDashboardMetrics> {
  const scope = await resolveFinanceScope(actor);
  const where = buildPaidTransactionsWhere(scope, filters);

  if (!where) {
    return emptyFinanceDashboard(scope);
  }

  const [summary, testDataCount, hotelGroups, recentTransactions, chartTransactions] =
    await prisma.$transaction([
      prisma.paymentTransaction.aggregate({
        where,
        _count: {
          _all: true,
        },
        _sum: {
          grossAmountCents: true,
          platformFeeCents: true,
          hotelNetAmountCents: true,
        },
      }),
      prisma.paymentTransaction.count({
        where: {
          ...where,
          isTestData: true,
        },
      }),
      prisma.paymentTransaction.groupBy({
        by: ["hotelId"],
        where,
        orderBy: {
          hotelId: "asc",
        },
        _count: {
          id: true,
        },
        _sum: {
          grossAmountCents: true,
          platformFeeCents: true,
          hotelNetAmountCents: true,
        },
      }),
      prisma.paymentTransaction.findMany({
        where,
        orderBy: [{ paidAt: "desc" }, { createdAt: "desc" }],
        take: getRecentLimit(filters.recentLimit),
        select: {
          id: true,
          reservationId: true,
          hotelId: true,
          provider: true,
          paymentMethod: true,
          status: true,
          grossAmountCents: true,
          platformFeeCents: true,
          hotelNetAmountCents: true,
          paidAt: true,
          createdAt: true,
          hotel: {
            select: {
              name: true,
              slug: true,
            },
          },
          reservation: {
            select: {
              guestName: true,
              room: {
                select: {
                  name: true,
                },
              },
            },
          },
        },
      }),
      prisma.paymentTransaction.findMany({
        where,
        orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
        select: {
          grossAmountCents: true,
          platformFeeCents: true,
          hotelNetAmountCents: true,
          paymentMethod: true,
          paidAt: true,
          createdAt: true,
        },
      }),
    ]);

  const hotelIds = hotelGroups.map((group) => group.hotelId);
  const hotels = hotelIds.length
    ? await prisma.hotel.findMany({
        where: {
          id: {
            in: hotelIds,
          },
        },
        select: {
          id: true,
          name: true,
          slug: true,
        },
      })
    : [];
  const hotelsById = new Map(hotels.map((hotel) => [hotel.id, hotel]));
  const totalMovementCents = summary._sum.grossAmountCents ?? 0;
  const platformRevenueCents = summary._sum.platformFeeCents ?? 0;
  const hotelNetEstimatedCents = summary._sum.hotelNetAmountCents ?? 0;
  const paidTransactionCount = summary._count._all;
  const trendByKey = new Map<
    string,
    {
      totalMovementCents: number;
      platformRevenueCents: number;
      hotelNetEstimatedCents: number;
      transactionCount: number;
    }
  >();
  const paymentMethodsByKey = new Map<
    string,
    {
      totalMovementCents: number;
      transactionCount: number;
    }
  >();

  for (const transaction of chartTransactions) {
    const date = transaction.paidAt ?? transaction.createdAt;
    const trendKey = getTrendKey(date, filters);
    const currentTrend = trendByKey.get(trendKey) ?? {
      totalMovementCents: 0,
      platformRevenueCents: 0,
      hotelNetEstimatedCents: 0,
      transactionCount: 0,
    };

    currentTrend.totalMovementCents += transaction.grossAmountCents;
    currentTrend.platformRevenueCents += transaction.platformFeeCents;
    currentTrend.hotelNetEstimatedCents += transaction.hotelNetAmountCents;
    currentTrend.transactionCount += 1;
    trendByKey.set(trendKey, currentTrend);

    const method = transaction.paymentMethod ?? "unknown";
    const currentMethod = paymentMethodsByKey.get(method) ?? {
      totalMovementCents: 0,
      transactionCount: 0,
    };

    currentMethod.totalMovementCents += transaction.grossAmountCents;
    currentMethod.transactionCount += 1;
    paymentMethodsByKey.set(method, currentMethod);
  }

  return {
    scope,
    summary: {
      totalMovement: toFinanceAmount(totalMovementCents),
      platformRevenue: toFinanceAmount(platformRevenueCents),
      hotelNetEstimated: toFinanceAmount(hotelNetEstimatedCents),
      paidTransactionCount,
      averageTicket: toFinanceAmount(
        getAverageTicketCents(totalMovementCents, paidTransactionCount)
      ),
    },
    byHotel: hotelGroups
      .map((group) => {
        const hotel = hotelsById.get(group.hotelId);
        const sums = group._sum ?? {};
        const hotelTotalMovementCents = sums.grossAmountCents ?? 0;
        const transactionCount =
          typeof group._count === "object" && group._count ? (group._count.id ?? 0) : 0;

        return {
          hotelId: group.hotelId,
          hotelName: hotel?.name ?? "Hotel não encontrado",
          hotelSlug: hotel?.slug ?? "",
          transactionCount,
          totalMovement: toFinanceAmount(hotelTotalMovementCents),
          platformRevenue: toFinanceAmount(sums.platformFeeCents ?? 0),
          hotelNetEstimated: toFinanceAmount(sums.hotelNetAmountCents ?? 0),
          averageTicket: toFinanceAmount(
            getAverageTicketCents(hotelTotalMovementCents, transactionCount)
          ),
        };
      })
      .sort((left, right) => right.totalMovement.cents - left.totalMovement.cents),
    recentTransactions: recentTransactions.map((transaction) => ({
      id: transaction.id,
      reservationId: transaction.reservationId,
      hotelId: transaction.hotelId,
      hotelName: transaction.hotel.name,
      hotelSlug: transaction.hotel.slug,
      roomName: transaction.reservation.room.name,
      guestName: transaction.reservation.guestName,
      provider: transaction.provider,
      paymentMethod: transaction.paymentMethod,
      status: "paid",
      paidAt: transaction.paidAt,
      createdAt: transaction.createdAt,
      totalMovement: toFinanceAmount(transaction.grossAmountCents),
      platformRevenue: toFinanceAmount(transaction.platformFeeCents),
      hotelNetEstimated: toFinanceAmount(transaction.hotelNetAmountCents),
    })),
    trend: Array.from(trendByKey.entries()).map(([key, value]) => ({
      key,
      label: formatTrendLabel(key),
      totalMovement: toFinanceAmount(value.totalMovementCents),
      platformRevenue: toFinanceAmount(value.platformRevenueCents),
      hotelNetEstimated: toFinanceAmount(value.hotelNetEstimatedCents),
      transactionCount: value.transactionCount,
    })),
    paymentMethods: Array.from(paymentMethodsByKey.entries())
      .map(([method, value]) => ({
        method,
        label: formatPaymentMethodLabel(method),
        transactionCount: value.transactionCount,
        totalMovement: toFinanceAmount(value.totalMovementCents),
      }))
      .sort((left, right) => right.totalMovement.cents - left.totalMovement.cents),
    containsTestData: testDataCount > 0,
  };
}
