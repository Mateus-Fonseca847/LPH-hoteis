import { AdminAccessError, requireAdminRouteSession } from "@/lib/auth";
import { getFinanceDashboardMetrics, type FinanceDashboardFilters } from "@/lib/finance";
import { prisma } from "@/lib/prisma";

import { AdminAccessDenied } from "../AdminAccessDenied";
import {
  FinancialDashboard,
  type FinancePeriod,
  financePeriodOptions,
} from "./FinanceDashboardComponents";

type FinancePageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

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

export default async function AdminFinancePage({ searchParams }: FinancePageProps) {
  let user;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedPeriod = parseFinancePeriod(getSearchParam(resolvedSearchParams, "period"));

  try {
    user = await requireAdminRouteSession("/admin/financeiro");
  } catch (error) {
    if (error instanceof AdminAccessError) {
      return <AdminAccessDenied />;
    }

    throw error;
  }

  const isSuperAdmin = user.globalRole === "super_admin";
  const hotels = isSuperAdmin
    ? await prisma.hotel.findMany({
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
        },
      })
    : await prisma.hotelPermission
        .findMany({
          where: {
            userId: user.id,
          },
          orderBy: {
            hotel: {
              name: "asc",
            },
          },
          select: {
            hotel: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
        .then((permissions) => permissions.map((permission) => permission.hotel));
  const requestedHotelId = getSearchParam(resolvedSearchParams, "hotelId");
  const selectedHotelId = hotels.some((hotel) => hotel.id === requestedHotelId)
    ? requestedHotelId
    : undefined;
  const metrics = await getFinanceDashboardMetrics(user, {
    ...getFinancePeriodFilters(selectedPeriod),
    hotelId: selectedHotelId,
    recentLimit: 10,
  });

  return (
    <FinancialDashboard
      metrics={metrics}
      selectedPeriod={selectedPeriod}
      selectedHotelId={selectedHotelId}
      hotels={hotels}
      isSuperAdmin={isSuperAdmin}
    />
  );
}
