const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();
const TEST_RECORDS = 36;
const PLATFORM_FEE_BASIS_POINTS = 1000;
const BASIS_POINTS = 10000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const PAYMENT_METHODS = ["pix", "credit_card", "debit_card", "boleto"];

function toUtcDate(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  return toUtcDate(new Date(date.getTime() + days * MS_PER_DAY));
}

function calculateAmounts(grossAmountCents) {
  const platformFeeCents = Math.floor(
    (grossAmountCents * PLATFORM_FEE_BASIS_POINTS) / BASIS_POINTS
  );

  return {
    grossAmountCents,
    platformFeeCents,
    hotelNetAmountCents: grossAmountCents - platformFeeCents,
  };
}

async function clearExistingTestData() {
  const deletedTransactions = await prisma.paymentTransaction.deleteMany({
    where: {
      isTestData: true,
    },
  });
  const deletedReservations = await prisma.reservation.deleteMany({
    where: {
      isTestData: true,
    },
  });

  return {
    deletedTransactions: deletedTransactions.count,
    deletedReservations: deletedReservations.count,
  };
}

async function main() {
  const hotels = await prisma.hotel.findMany({
    where: {
      rooms: {
        some: {
          isActive: true,
        },
      },
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      rooms: {
        where: {
          isActive: true,
        },
        orderBy: {
          name: "asc",
        },
        select: {
          id: true,
          name: true,
          capacityAdults: true,
          capacityChildren: true,
          priceFrom: true,
        },
      },
    },
  });

  if (!hotels.length) {
    throw new Error(
      "Nenhum hotel com quarto ativo encontrado para gerar dados financeiros de teste."
    );
  }

  const cleanup = await clearExistingTestData();
  const today = toUtcDate(new Date());
  const created = [];

  for (let index = 0; index < TEST_RECORDS; index += 1) {
    const hotel = hotels[index % hotels.length];
    const room = hotel.rooms[index % hotel.rooms.length];
    const nights = 1 + (index % 5);
    const adults = Math.max(1, Math.min(room.capacityAdults || 1, 1 + (index % 2)));
    const children = Math.min(room.capacityChildren || 0, index % 3);
    const basePriceCents = Number(room.priceFrom)
      ? Math.round(Number(room.priceFrom) * 100)
      : 42000;
    const variationCents = ((index % 7) - 2) * 3500;
    const nightlyPriceCents = Math.max(22000, basePriceCents + variationCents);
    const totalPriceCents = nightlyPriceCents * nights;
    const paidAt = addDays(today, -(index * 3) % 90);
    const checkIn = addDays(paidAt, 12 + (index % 18));
    const checkOut = addDays(checkIn, nights);
    const paymentMethod = PAYMENT_METHODS[index % PAYMENT_METHODS.length];
    const providerPaymentId = `test_finance_${Date.now()}_${index}`;
    const amounts = calculateAmounts(totalPriceCents);

    const reservation = await prisma.reservation.create({
      data: {
        hotelId: hotel.id,
        roomId: room.id,
        guestName: `DADO DE TESTE - Hóspede Financeiro ${String(index + 1).padStart(2, "0")}`,
        guestEmail: `financeiro-teste-${index + 1}@example.test`,
        guestPhone: `(11) 90000-${String(1000 + index).slice(-4)}`,
        guestDocument: `TESTE${String(100000 + index)}`,
        checkIn,
        checkOut,
        adults,
        children,
        nights,
        nightlyPriceCents,
        totalPriceCents,
        currency: "BRL",
        status: "confirmed",
        paymentProvider: "mercado_pago",
        paymentMethod,
        paymentStatus: "paid",
        providerPaymentId,
        paidAt,
        isTestData: true,
        paymentTransaction: {
          create: {
            hotelId: hotel.id,
            provider: "mercado_pago",
            paymentMethod,
            status: "paid",
            ...amounts,
            currency: "BRL",
            paidAt,
            isTestData: true,
          },
        },
      },
      select: {
        id: true,
      },
    });

    created.push(reservation.id);
  }

  console.log(
    `Dados financeiros de teste recriados. Reservas: ${created.length}. Removidos antes: ${cleanup.deletedReservations} reserva(s), ${cleanup.deletedTransactions} transação(ões).`
  );
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
