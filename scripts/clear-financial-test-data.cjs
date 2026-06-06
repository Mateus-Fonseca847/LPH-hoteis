const { PrismaClient } = require("@prisma/client");
require("dotenv").config();

const prisma = new PrismaClient();

async function main() {
  // Segurança: este script remove somente registros marcados explicitamente como dados de teste.
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

  console.log(
    `Dados financeiros de teste removidos. Reservas: ${deletedReservations.count}. Transações: ${deletedTransactions.count}.`
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
