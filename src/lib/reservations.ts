import { sendTransactionalEmail } from "@/lib/email";
import { formatPriceInBRL } from "@/lib/stay-query";

type ReservationEmailInput = {
  hotelEmail: string;
  hotelName: string;
  roomName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  guestDocument?: string;
  checkIn: Date;
  checkOut: Date;
  adults: number;
  children: number;
  nights: number;
  nightlyPriceCents: number;
  totalPriceCents: number;
  reservationId: string;
  paymentMethod?: string | null;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function buildReservationEmailLines(input: ReservationEmailInput) {
  return [
    `Reserva: ${input.reservationId}`,
    `Hotel: ${input.hotelName}`,
    `Quarto: ${input.roomName}`,
    "",
    "Hóspede",
    `Nome: ${input.guestName}`,
    `E-mail: ${input.guestEmail}`,
    `Telefone: ${input.guestPhone}`,
    ...(input.guestDocument ? [`Documento: ${input.guestDocument}`] : []),
    "",
    "Estadia",
    `Check-in: ${formatDate(input.checkIn)}`,
    `Check-out: ${formatDate(input.checkOut)}`,
    `Noites: ${input.nights}`,
    `Viajantes: ${input.adults} adulto(s) e ${input.children} criança(s)`,
    `Valor por noite: ${formatPriceInBRL(input.nightlyPriceCents)}`,
    `Valor total: ${formatPriceInBRL(input.totalPriceCents)}`,
    ...(input.paymentMethod ? [`Método de pagamento: ${input.paymentMethod}`] : []),
  ];
}

function buildReservationEmailHtml(input: ReservationEmailInput, intro: string) {
  const rows = [
    ["Reserva", input.reservationId],
    ["Hotel", input.hotelName],
    ["Quarto", input.roomName],
    ["Hóspede", input.guestName],
    ["E-mail", input.guestEmail],
    ["Telefone", input.guestPhone],
    ...(input.guestDocument ? ([["Documento", input.guestDocument]] as const) : []),
    ["Check-in", formatDate(input.checkIn)],
    ["Check-out", formatDate(input.checkOut)],
    ["Noites", String(input.nights)],
    ["Viajantes", `${input.adults} adulto(s) e ${input.children} criança(s)`],
    ["Valor por noite", formatPriceInBRL(input.nightlyPriceCents)],
    ["Valor total", formatPriceInBRL(input.totalPriceCents)],
    ...(input.paymentMethod ? ([["Método de pagamento", input.paymentMethod]] as const) : []),
  ];

  return `
    <p>${escapeHtml(intro)}</p>
    <table cellpadding="8" cellspacing="0" style="border-collapse: collapse;">
      ${rows
        .map(
          ([label, value]) => `
            <tr>
              <td style="border: 1px solid #e5e7eb; font-weight: 700;">${escapeHtml(label)}</td>
              <td style="border: 1px solid #e5e7eb;">${escapeHtml(value)}</td>
            </tr>
          `
        )
        .join("")}
    </table>
  `;
}

export async function sendHotelReservationEmail(input: ReservationEmailInput) {
  await sendTransactionalEmail({
    to: input.hotelEmail,
    subject: `Nova reserva paga pelo site - ${input.hotelName}`,
    text: [
      "Uma nova reserva paga foi feita pelo site.",
      "",
      ...buildReservationEmailLines(input),
    ].join("\n"),
    html: buildReservationEmailHtml(input, "Uma nova reserva paga foi feita pelo site."),
  });
}

export async function sendGuestReservationEmail(input: ReservationEmailInput) {
  await sendTransactionalEmail({
    to: input.guestEmail,
    subject: `Reserva paga - ${input.hotelName}`,
    text: [
      `Olá, ${input.guestName}.`,
      "",
      "Seu pagamento foi aprovado e sua reserva foi recebida pelo site.",
      "Em caso de dúvidas, entre em contato diretamente com o hotel.",
      "",
      ...buildReservationEmailLines(input),
    ].join("\n"),
    html: buildReservationEmailHtml(
      input,
      `Olá, ${input.guestName}. Seu pagamento foi aprovado e sua reserva foi recebida pelo site. Em caso de dúvidas, entre em contato diretamente com o hotel.`
    ),
  });
}
