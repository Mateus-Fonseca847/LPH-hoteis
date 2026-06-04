const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtcDate(date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function addDays(date, days) {
  return toUtcDate(new Date(date.getTime() + days * MS_PER_DAY));
}

function dateRange(startOffset, length) {
  const today = toUtcDate(new Date());
  return Array.from({ length }, (_, index) => addDays(today, startOffset + index));
}

function buildAvailability(totalUnits, startOffset = 1, days = 45) {
  return dateRange(startOffset, days).map((date, index) => ({
    date,
    totalUnits,
    availableUnits: index % 19 === 0 ? Math.max(0, totalUnits - 1) : totalUnits,
    closed: false,
    note: null,
  }));
}

function buildRates(basePriceCents, maxGuests, startOffset = 1) {
  const today = toUtcDate(new Date());

  return [
    {
      name: "Tarifa flexivel",
      description: "Tarifa demonstrativa com cafe da manha incluso.",
      priceCents: basePriceCents,
      currency: "BRL",
      startDate: addDays(today, startOffset),
      endDate: addDays(today, startOffset + 120),
      minNights: 1,
      maxGuests,
      refundable: true,
      breakfastIncluded: true,
      isActive: true,
    },
    {
      name: "Tarifa antecipada",
      description: "Tarifa demonstrativa com pagamento antecipado.",
      priceCents: Math.round(basePriceCents * 0.9),
      currency: "BRL",
      startDate: addDays(today, startOffset + 5),
      endDate: addDays(today, startOffset + 150),
      minNights: 2,
      maxGuests,
      refundable: false,
      breakfastIncluded: true,
      isActive: true,
    },
  ];
}

function room({
  name,
  description,
  imageUrl,
  adults,
  children = 0,
  beds,
  sizeM2,
  amenities,
  priceFrom,
  units,
}) {
  const capacity = adults + children;
  const priceCents = Math.round(priceFrom * 100);

  return {
    name,
    description,
    imageUrl,
    capacity,
    capacityAdults: adults,
    capacityChildren: children,
    beds,
    size: `${sizeM2} m²`,
    sizeM2,
    amenities,
    priceFrom: priceFrom.toFixed(2),
    isAvailable: true,
    isActive: true,
    rates: buildRates(priceCents, capacity),
    availability: buildAvailability(units),
  };
}

const hotels = [
  {
    slug: "hotel-teste-paulista",
    name: "Hotel Teste Paulista",
    shortDescription: "Hotel urbano generico para validar fluxo publico em Sao Paulo.",
    fullDescription:
      "O Hotel Teste Paulista foi adicionado como conteudo de apoio para validar navegacao publica, mapa interativo e pagina de detalhes. Tem perfil executivo, localizacao central e estrutura simples para exercicios de interface.",
    city: "Sao Paulo",
    state: "SP",
    address: "Rua de Teste, 120 - Bela Vista, Sao Paulo - SP",
    phone: "(11) 4000-1001",
    email: "reservas+teste-paulista@lph.test",
    whatsapp: "(11) 99100-1001",
    coverImageUrl:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    latitude: "-23.5654000",
    longitude: "-46.6629000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
        alt: "Suite moderna com tons neutros",
      },
      {
        url: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
        alt: "Quarto contemporaneo com bancada",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Lobby com recepcao elegante",
      },
    ],
    amenities: ["Wi-Fi", "Cafe da manha", "Recepcao 24h", "Academia", "Sala de reunioes"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito ate 48 horas antes." },
      { title: "Check-in", description: "Documento com foto obrigatorio na chegada." },
      { title: "Estacionamento", description: "Vagas limitadas mediante disponibilidade." },
    ],
    rooms: [
      room({
        name: "Studio Teste",
        description: "Quarto funcional para testes do fluxo publico.",
        imageUrl:
          "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama queen",
        sizeM2: 24,
        amenities: ["Mesa de trabalho", "Smart TV", "Frigobar"],
        priceFrom: 540,
        units: 8,
      }),
    ],
  },
  {
    slug: "hotel-teste-recife",
    name: "Hotel Teste Recife",
    shortDescription: "Opcao generica na orla para validar pins e card do mapa.",
    fullDescription:
      "O Hotel Teste Recife existe apenas para testes de navegacao publica. A unidade simula um hotel de lazer com boa localizacao, imagem de capa e dados completos para exercitar listagem, mapa e pagina individual.",
    city: "Recife",
    state: "PE",
    address: "Avenida Litoral, 450 - Boa Viagem, Recife - PE",
    phone: "(81) 4000-2002",
    email: "reservas+teste-recife@lph.test",
    whatsapp: "(81) 99200-2002",
    coverImageUrl:
      "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    latitude: "-8.1268000",
    longitude: "-34.9007000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80",
        alt: "Area externa de hotel com piscina",
      },
      {
        url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
        alt: "Deck com espreguicadeiras",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Suite com varanda",
      },
    ],
    amenities: ["Piscina", "Restaurante", "Wi-Fi", "Vista para o mar", "Room service"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito ate 5 dias antes." },
      { title: "Cafe da manha", description: "Servico incluso em todas as reservas." },
      { title: "Horario", description: "Area de lazer aberta ate as 22h." },
    ],
    rooms: [
      room({
        name: "Superior Mar",
        description: "Categoria demonstrativa com vista lateral para o mar.",
        imageUrl:
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama queen",
        sizeM2: 28,
        amenities: ["Vista lateral", "Wi-Fi", "Smart TV"],
        priceFrom: 590,
        units: 7,
      }),
    ],
  },
  {
    slug: "hotel-teste-salvador",
    name: "Hotel Teste Salvador",
    shortDescription: "Hospedagem generica com perfil cultural para testar a pagina publica.",
    fullDescription:
      "O Hotel Teste Salvador foi criado para testar o fluxo entre mapa, pin e detalhes do hotel. O conteudo representa um hotel boutique com operacao enxuta, imagens validas e informacoes suficientes para navegacao completa.",
    city: "Salvador",
    state: "BA",
    address: "Rua do Centro, 88 - Santo Antonio, Salvador - BA",
    phone: "(71) 4000-3003",
    email: "reservas+teste-salvador@lph.test",
    whatsapp: "(71) 99300-3003",
    coverImageUrl:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "15:00",
    checkOutTime: "12:00",
    latitude: "-12.9718000",
    longitude: "-38.5011000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
        alt: "Varanda de hotel com vista urbana",
      },
      {
        url: "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1400&q=80",
        alt: "Area de estar iluminada",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Suite com acabamento claro",
      },
    ],
    amenities: ["Terraco", "Cafe regional", "Wi-Fi", "Transfer", "Recepcao 24h"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito ate 7 dias antes." },
      { title: "Silencio", description: "Horario de silencio nas areas comuns apos 23h." },
      { title: "Criancas", description: "Hospedagem infantil sujeita a categoria escolhida." },
    ],
    rooms: [
      room({
        name: "Suite Centro",
        description: "Suite demonstrativa para testes de navegacao e reserva.",
        imageUrl:
          "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama queen",
        sizeM2: 26,
        amenities: ["Ar-condicionado", "Wi-Fi", "Frigobar"],
        priceFrom: 520,
        units: 6,
      }),
    ],
  },
  {
    slug: "hotel-teste-brasilia",
    name: "Hotel Teste Brasilia",
    shortDescription: "Hotel generico de perfil executivo para testar cards e navegacao.",
    fullDescription:
      "O Hotel Teste Brasilia foi incluido para exercitar o fluxo completo do front com um hotel de negocios. Ele cobre capa, galeria, contatos, politicas e localizacao resolvida por cidade e estado.",
    city: "Brasilia",
    state: "DF",
    address: "Setor de Hospedagem, Quadra 5 - Asa Sul, Brasilia - DF",
    phone: "(61) 4000-4004",
    email: "reservas+teste-brasilia@lph.test",
    whatsapp: "(61) 99400-4004",
    coverImageUrl:
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    latitude: "-15.8310000",
    longitude: "-47.8728000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80",
        alt: "Lobby de hotel com iluminacao suave",
      },
      {
        url: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
        alt: "Quarto executivo com bancada",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Area social interna",
      },
    ],
    amenities: ["Coworking", "Cafe da manha", "Wi-Fi premium", "Lavanderia", "Concierge"],
    policies: [
      { title: "Cancelamento", description: "Reembolso integral ate 72 horas antes." },
      { title: "Early check-in", description: "Disponivel sob consulta previa." },
      { title: "Consumo", description: "Extras sao cobrados no check-out." },
    ],
    rooms: [
      room({
        name: "Business Prime",
        description: "Quarto demonstrativo com foco em viagem corporativa.",
        imageUrl:
          "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama queen",
        sizeM2: 27,
        amenities: ["Mesa de trabalho", "Wi-Fi premium", "Cofre"],
        priceFrom: 610,
        units: 8,
      }),
    ],
  },
  {
    slug: "hotel-teste-floripa",
    name: "Hotel Teste Floripa",
    shortDescription: "Opcao generica em Florianopolis para validar mapa e pagina de hotel.",
    fullDescription:
      "O Hotel Teste Floripa fecha o conjunto de dados de apoio para testes. Ele simula uma hospedagem de praia com informacoes completas, visual publico consistente e cidade coberta pelo catalogo interno do mapa.",
    city: "Florianopolis",
    state: "SC",
    address: "Avenida Costeira, 210 - Centro, Florianopolis - SC",
    phone: "(48) 4000-5005",
    email: "reservas+teste-floripa@lph.test",
    whatsapp: "(48) 99500-5005",
    coverImageUrl:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    latitude: "-27.5949000",
    longitude: "-48.5482000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
        alt: "Fachada de hotel com area de lazer externa",
      },
      {
        url: "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80",
        alt: "Piscina com vista aberta",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Suite clara com varanda",
      },
    ],
    amenities: ["Piscina", "Rooftop", "Wi-Fi", "Cafe da manha", "Bicicletario"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito ate 72 horas antes." },
      { title: "Garagem", description: "Vagas sujeitas a disponibilidade no dia." },
      { title: "Lazer", description: "Piscina pode fechar para manutencao preventiva." },
    ],
    rooms: [
      room({
        name: "Suite Orla",
        description: "Suite demonstrativa para validar detalhes do hotel publico.",
        imageUrl:
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama queen",
        sizeM2: 29,
        amenities: ["Varanda", "Smart TV", "Frigobar"],
        priceFrom: 580,
        units: 7,
      }),
    ],
  },
];

async function upsertHotel(hotel) {
  const baseData = {
    slug: hotel.slug,
    name: hotel.name,
    shortDescription: hotel.shortDescription,
    fullDescription: hotel.fullDescription,
    city: hotel.city,
    state: hotel.state,
    address: hotel.address,
    phone: hotel.phone,
    email: hotel.email,
    whatsapp: hotel.whatsapp,
    coverImageUrl: hotel.coverImageUrl,
    checkInTime: hotel.checkInTime,
    checkOutTime: hotel.checkOutTime,
    latitude: new Prisma.Decimal(hotel.latitude),
    longitude: new Prisma.Decimal(hotel.longitude),
    isPublished: true,
  };

  await prisma.$transaction(async (tx) => {
    const savedHotel = await tx.hotel.upsert({
      where: { slug: hotel.slug },
      create: baseData,
      update: baseData,
    });

    await tx.hotelImage.deleteMany({ where: { hotelId: savedHotel.id } });
    await tx.hotelRoom.deleteMany({ where: { hotelId: savedHotel.id } });
    await tx.hotelAmenity.deleteMany({ where: { hotelId: savedHotel.id } });
    await tx.hotelPolicy.deleteMany({ where: { hotelId: savedHotel.id } });

    await tx.hotelImage.createMany({
      data: hotel.galleryImages.map((image, index) => ({
        hotelId: savedHotel.id,
        url: image.url,
        alt: image.alt,
        position: index,
      })),
    });

    await tx.hotelAmenity.createMany({
      data: hotel.amenities.map((label, index) => ({
        hotelId: savedHotel.id,
        label,
        position: index,
      })),
    });

    await tx.hotelPolicy.createMany({
      data: hotel.policies.map((policy, index) => ({
        hotelId: savedHotel.id,
        title: policy.title,
        description: policy.description,
        position: index,
      })),
    });

    for (const roomData of hotel.rooms) {
      const savedRoom = await tx.hotelRoom.create({
        data: {
          hotelId: savedHotel.id,
          name: roomData.name,
          description: roomData.description,
          imageUrl: roomData.imageUrl,
          capacity: roomData.capacity,
          capacityAdults: roomData.capacityAdults,
          capacityChildren: roomData.capacityChildren,
          beds: roomData.beds,
          size: roomData.size,
          sizeM2: roomData.sizeM2,
          amenities: roomData.amenities,
          priceFrom: new Prisma.Decimal(roomData.priceFrom),
          isAvailable: roomData.isAvailable,
          isActive: roomData.isActive,
        },
      });

      await tx.roomRate.createMany({
        data: roomData.rates.map((rateData) => ({
          roomId: savedRoom.id,
          ...rateData,
        })),
      });

      await tx.roomAvailability.createMany({
        data: roomData.availability.map((availabilityData) => ({
          roomId: savedRoom.id,
          ...availabilityData,
        })),
      });
    }
  });
}

async function main() {
  for (const hotel of hotels) {
    await upsertHotel(hotel);
    console.log(`OK ${hotel.slug}`);
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (error) => {
    console.error("Seed failed:", error);
    await prisma.$disconnect();
    process.exit(1);
  });
