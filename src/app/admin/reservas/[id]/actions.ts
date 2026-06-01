"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdminRouteSession } from "@/lib/auth";
import {
  addReservationInternalNote,
  cancelReservationManually,
  confirmReservationManually,
  markReservationPaymentFailed,
  rescheduleReservationManually,
  resendReservationConfirmationEmail,
} from "@/lib/admin/reservation-operations";
import { requireHotelAdminAccess } from "@/lib/auth/authorization";
import { syncMercadoPagoPayment } from "@/lib/payments/mercado-pago-reconciliation";
import { prisma } from "@/lib/prisma";

type Operation = "cancel" | "confirm" | "fail-payment" | "resend-email" | "note" | "reschedule";

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
    } else if (operation === "confirm") {
      await confirmReservationManually({
        reservationId,
        userId: user.id,
        reason: getReason(formData),
      });
    } else if (operation === "fail-payment") {
      await markReservationPaymentFailed({
        reservationId,
        userId: user.id,
        reason: getReason(formData),
      });
    } else if (operation === "resend-email") {
      await resendReservationConfirmationEmail({
        reservationId,
        userId: user.id,
        reason: getReason(formData),
      });
    } else if (operation === "note") {
      await addReservationInternalNote({
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
    } else {
      throw new Error("Operacao invalida.");
    }
  } catch (error) {
    status = "error";
    message = error instanceof Error ? error.message : "Operacao nao concluida.";
  }

  revalidatePath(`/admin/reservas/${reservationId}`);
  redirectWithOperationStatus(reservationId, status, message);
}
