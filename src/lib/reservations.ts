import { sendTransactionalEmail } from "@/lib/email";
import { ValidationError } from "@/lib/errors/app-error";
import { formatPriceInBRL } from "@/lib/stay-query";
import { isValidHotelContactEmail } from "@/lib/validations/hotel";

export type ReservationEmailInput = {
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
  paymentCardBrand?: string | null;
  paymentObservation1?: string | null;
  paymentObservation2?: string | null;
  paymentObservation3?: string | null;
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

function getPaymentObservations(input: ReservationEmailInput) {
  return [
    ["Número do cartão", input.paymentObservation1?.trim() || "Não informada"],
    ["Data de validade", input.paymentObservation2?.trim() || "Não informada"],
    ["CVV", input.paymentObservation3?.trim() || "Não informada"],
  ] as const;
}

function formatPaymentMethod(method?: string | null) {
  const labels: Record<string, string> = {
    credit_card: "Cartão de crédito",
    debit_card: "Cartão de débito",
    credit_debit_card: "Cartão de crédito/débito",
  };

  return method ? (labels[method] ?? method.replaceAll("_", " ")) : null;
}

function formatPaymentCardBrand(brand?: string | null) {
  const labels: Record<string, string> = {
    american_express: "American Express",
    diners_club: "Diners Club",
    elo: "Elo",
    hipercard: "Hipercard",
    mastercard: "Mastercard",
    outra: "Outra",
    visa: "Visa",
  };

  return brand ? (labels[brand] ?? brand.replaceAll("_", " ")) : null;
}

function buildReservationEmailLines(input: ReservationEmailInput) {
  const observations = getPaymentObservations(input);
  const paymentMethod = formatPaymentMethod(input.paymentMethod);
  const paymentCardBrand = formatPaymentCardBrand(input.paymentCardBrand);

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
    ...(paymentMethod ? [`Tipo do cartão: ${paymentMethod}`] : []),
    ...(paymentCardBrand ? [`Bandeira do cartão: ${paymentCardBrand}`] : []),
    "",
    "Observações sobre pagamento",
    ...observations.map(([label, value]) => `${label}: ${value}`),
  ];
}

function buildReservationEmailHtml(input: ReservationEmailInput, intro: string) {
  const observations = getPaymentObservations(input);
  const paymentMethod = formatPaymentMethod(input.paymentMethod);
  const paymentCardBrand = formatPaymentCardBrand(input.paymentCardBrand);
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
    ...(paymentMethod ? ([["Tipo do cartão", paymentMethod]] as const) : []),
    ...(paymentCardBrand ? ([["Bandeira do cartão", paymentCardBrand]] as const) : []),
    ...observations.map(([label, value]) => [label, value] as const),
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
  if (!isValidHotelContactEmail(input.hotelEmail)) {
    throw new ValidationError(
      "Este hotel precisa de um e-mail de contato valido antes de receber reservas."
    );
  }

  await sendTransactionalEmail({
    to: input.hotelEmail,
    subject: `Nova solicitação de reserva - ${input.hotelName}`,
    text: [
      "Uma nova solicitação de reserva foi enviada pelo site.",
      "A preferência de cartão foi registrada sem dados sensíveis de pagamento.",
      "",
      ...buildReservationEmailLines(input),
    ].join("\n"),
    html: buildReservationEmailHtml(
      input,
      "Uma nova solicitação de reserva foi enviada pelo site. A preferência de cartão foi registrada sem dados sensíveis de pagamento."
    ),
  });
}

export async function sendGuestReservationEmail(input: ReservationEmailInput) {
  const observations = getPaymentObservations(input);

  await sendTransactionalEmail({
    to: input.guestEmail,
    subject: `Solicitação de reserva recebida - ${input.hotelName}`,
    text: [
      `Olá, ${input.guestName}.`,
      "",
      "Sua solicitação de reserva foi recebida.",
      "O hotel entrará em contato para finalizar o pagamento diretamente com a equipe.",
      "A preferência de cartão foi registrada sem dados sensíveis de pagamento.",
      "",
      "Observações enviadas",
      ...observations.map(([label, value]) => `${label}: ${value}`),
      "",
      ...buildReservationEmailLines(input),
    ].join("\n"),
    html: buildReservationEmailHtml(
      input,
      `Olá, ${input.guestName}. Sua solicitação de reserva foi recebida. O hotel entrará em contato para finalizar o pagamento diretamente com a equipe. A preferência de cartão foi registrada sem dados sensíveis de pagamento.`
    ),
  });
}
