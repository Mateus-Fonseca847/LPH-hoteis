"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminRouteSession } from "@/lib/auth";
import {
  cancelReservationManually,
  rescheduleReservationManually,
  updatePendingReservationPaymentStatusManually,
} from "@/lib/admin/reservation-operations";
import { requireHotelAdminAccess } from "@/lib/auth/authorization";
import { syncMercadoPagoPayment } from "@/lib/payments/mercado-pago-reconciliation";
import { prisma } from "@/lib/prisma";

type Operation = "cancel" | "reschedule" | "update-payment-status";

function getReason(formData: FormData) {
  return String(formData.get("reason") || "");
}

function redirectWithOperationStatus(
  reservationId: string,
  status: string,
  message?: string
): never {
  const params = new URLSearchParams({
    operation: status,
  });

  if (message) {
    params.set("message", message);
  }

  redirect(`/admin/reservas/${reservationId}?${params.toString()}`);
}

export async function reconcileReservationPaymentAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") || "");
  const reservation = await prisma.reservation.findUnique({
    where: {
      id: reservationId,
    },
    select: {
      id: true,
      hotelId: true,
      providerPaymentId: true,
    },
  });

  if (!reservation) {
    redirect("/admin/reservas?paymentReconciliation=not_found");
  }

  const user = await requireAdminRouteSession(`/admin/reservas/${reservation.id}`);
  await requireHotelAdminAccess(user.id, reservation.hotelId);

  let status = "success";

  try {
    await syncMercadoPagoPayment({
      reservationId: reservation.id,
      preferenceId: reservation.providerPaymentId,
      source: "manual",
    });
  } catch {
    status = "error";
  }

  revalidatePath(`/admin/reservas/${reservation.id}`);
  redirect(`/admin/reservas/${reservation.id}?paymentReconciliation=${status}`);
}

export async function reservationOperationAction(formData: FormData) {
  const reservationId = String(formData.get("reservationId") || "");
  const operation = String(formData.get("operation") || "") as Operation;
  const user = await requireAdminRouteSession(`/admin/reservas/${reservationId}`);
  let status = "success";
  let message: string | undefined;

  try {
    if (operation === "cancel") {
      await cancelReservationManually({
        reservationId,
        userId: user.id,
        reason: getReason(formData),
      });
    } else if (operation === "reschedule") {
      await rescheduleReservationManually({
        reservationId,
        userId: user.id,
        reason: getReason(formData),
        checkIn: String(formData.get("checkIn") || ""),
        checkOut: String(formData.get("checkOut") || ""),
      });
    } else if (operation === "update-payment-status") {
      await updatePendingReservationPaymentStatusManually({
        reservationId,
        userId: user.id,
        reason: getReason(formData),
        nextPaymentStatus: String(formData.get("nextPaymentStatus") || "") as
          | "pending"
          | "awaiting_payment"
          | "paid"
          | "payment_failed"
          | "cancelled",
      });
    } else {
      throw new Error("Operação inválida.");
    }
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Operação não concluída.";
  }

  revalidatePath(`/admin/reservas/${reservationId}`);
  redirectWithOperationStatus(reservationId, status, message);
}
