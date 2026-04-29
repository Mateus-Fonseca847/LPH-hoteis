const { PrismaClient, Prisma } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;

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

function buildAvailability(totalUnits, startOffset = 1, days = 60) {
  return dateRange(startOffset, days).map((date, index) => {
    const isWeekend = [5, 6].includes(date.getUTCDay());
    const softClosed = index % 23 === 0;
    const availableUnits = softClosed ? 0 : Math.max(1, totalUnits - (isWeekend ? 1 : 0));

    return {
      date,
      totalUnits,
      availableUnits,
      closed: softClosed,
      note: softClosed ? "Bloqueio operacional demonstrativo." : null,
    };
  });
}

function buildRates(basePriceCents, maxGuests, startOffset = 1) {
  const today = toUtcDate(new Date());

  return [
    {
      name: "Tarifa flexivel",
      description:
        "Tarifa com cafe da manha incluido e alteracao permitida conforme disponibilidade.",
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
      description:
        "Condicao promocional para reservas planejadas, com pagamento antecipado e menor tarifa.",
      priceCents: Math.round(basePriceCents * 0.88),
      currency: "BRL",
      startDate: addDays(today, startOffset + 7),
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
    size: `${sizeM2} m2`,
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
    slug: "lph-marina-santos",
    name: "LPH Marina Santos",
    shortDescription:
      "Hotel urbano de frente para a marina, com rotina pratica para lazer e viagens corporativas.",
    fullDescription:
      "O LPH Marina Santos combina vista para o canal, ambientes claros e servicos pensados para estadias curtas ou prolongadas. A operacao atende bem quem precisa circular pela Baixada Santista sem abrir mao de conforto, boa gastronomia e apoio de concierge.",
    city: "Santos",
    state: "SP",
    address: "Avenida Almirante Saldanha, 410 - Ponta da Praia, Santos - SP",
    phone: "(13) 3201-4400",
    email: "reservas.marina@lphhoteis.com.br",
    whatsapp: "(13) 99740-4410",
    coverImageUrl:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    latitude: "-23.9882000",
    longitude: "-46.3032000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
        alt: "Piscina externa com espreguicadeiras e fachada do hotel",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Suite clara com cama ampla e varanda",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Recepcao contemporanea com area de espera",
      },
    ],
    amenities: [
      "Piscina com deck",
      "Restaurante autoral",
      "Wi-Fi de alta velocidade",
      "Sala de reunioes",
      "Estacionamento com manobrista",
      "Concierge",
    ],
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento sem custo ate 72 horas antes da chegada.",
      },
      {
        title: "Criancas",
        description: "Criancas sao bem-vindas e podem usar cama extra mediante confirmacao.",
      },
      {
        title: "Estacionamento",
        description: "Vagas sujeitas a disponibilidade, com cobranca diaria informada no check-in.",
      },
    ],
    rooms: [
      room({
        name: "Executivo Marina",
        description:
          "Quarto funcional com bancada de trabalho, boa iluminacao natural e vista lateral para a marina.",
        imageUrl:
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama queen",
        sizeM2: 27,
        amenities: ["Wi-Fi", "Smart TV", "Mesa de trabalho", "Frigobar"],
        priceFrom: 520,
        units: 8,
      }),
      room({
        name: "Suite Frente Mar",
        description:
          "Acomodacao mais ampla com sala compacta, varanda mobiliada e enxoval premium.",
        imageUrl:
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        children: 1,
        beds: "1x Cama king | 1x Sofa-cama",
        sizeM2: 42,
        amenities: ["Varanda", "Vista para a marina", "Cafeteira", "Roupao"],
        priceFrom: 760,
        units: 4,
      }),
    ],
  },
  {
    slug: "lph-serra-dos-araucarias",
    name: "LPH Serra dos Araucarias",
    shortDescription:
      "Refugio serrano com clima reservado, lareira e estrutura para fins de semana de descanso.",
    fullDescription:
      "O LPH Serra dos Araucarias oferece uma experiencia acolhedora na Serra Gaucha, com quartos silenciosos, restaurante de ingredientes locais e areas sociais voltadas ao descanso. A proposta equilibra conforto, natureza e atendimento proximo.",
    city: "Gramado",
    state: "RS",
    address: "Estrada Linha Bonita, 1280 - Zona Rural, Gramado - RS",
    phone: "(54) 3295-1180",
    email: "reservas.araucarias@lphhoteis.com.br",
    whatsapp: "(54) 99620-1180",
    coverImageUrl:
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "15:00",
    checkOutTime: "12:00",
    latitude: "-29.3793000",
    longitude: "-50.8735000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80",
        alt: "Fachada de hotel serrano cercado por jardim",
      },
      {
        url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
        alt: "Quarto aconchegante com cabeceira de madeira",
      },
      {
        url: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80",
        alt: "Lounge com poltronas e iluminacao quente",
      },
    ],
    amenities: [
      "Lareira no lobby",
      "Restaurante regional",
      "Spa compacto",
      "Trilhas guiadas",
      "Cafe colonial",
      "Estacionamento",
    ],
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito ate 7 dias antes da hospedagem.",
      },
      {
        title: "Pets",
        description: "Pets de pequeno porte sao aceitos em categorias selecionadas.",
      },
      {
        title: "Silencio",
        description: "Areas externas seguem horario de silencio a partir das 22h.",
      },
    ],
    rooms: [
      room({
        name: "Chale Jardim",
        description: "Quarto com varanda para o jardim, calefacao e composicao ideal para casais.",
        imageUrl:
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama king",
        sizeM2: 31,
        amenities: ["Calefacao", "Varanda", "Smart TV", "Amenities premium"],
        priceFrom: 690,
        units: 6,
      }),
      room({
        name: "Suite Familia Serra",
        description:
          "Suite com dois ambientes, sofa-cama e espaco adicional para familias em estadias de lazer.",
        imageUrl:
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        children: 2,
        beds: "1x Cama queen | 2x Cama de solteiro",
        sizeM2: 46,
        amenities: ["Dois ambientes", "Berco sob pedido", "Frigobar", "Vista para o bosque"],
        priceFrom: 940,
        units: 5,
      }),
    ],
  },
  {
    slug: "lph-jardins-business",
    name: "LPH Jardins Business",
    shortDescription:
      "Hotel executivo nos Jardins, com quartos silenciosos e apoio para agendas intensas.",
    fullDescription:
      "O LPH Jardins Business foi desenhado para quem precisa de localizacao central em Sao Paulo, check-in agil e ambientes confortaveis para trabalhar ou descansar. A estrutura inclui coworking reservado, room service e conexao facil aos principais corredores da cidade.",
    city: "Sao Paulo",
    state: "SP",
    address: "Alameda Lorena, 870 - Jardins, Sao Paulo - SP",
    phone: "(11) 3123-8700",
    email: "reservas.jardins@lphhoteis.com.br",
    whatsapp: "(11) 99712-8700",
    coverImageUrl:
      "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "11:00",
    latitude: "-23.5654000",
    longitude: "-46.6629000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
        alt: "Suite urbana com decoracao contemporanea",
      },
      {
        url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
        alt: "Ambiente interno moderno com luz natural",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Lobby com recepcao e area de espera",
      },
    ],
    amenities: [
      "Coworking reservado",
      "Academia",
      "Room service",
      "Valet",
      "Wi-Fi premium",
      "Lavanderia expressa",
    ],
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento sem custo ate 48 horas antes do check-in.",
      },
      {
        title: "Check-in antecipado",
        description: "Disponivel mediante ocupacao do dia e confirmacao previa.",
      },
      {
        title: "Nao fumantes",
        description: "Todos os quartos e areas internas sao ambientes nao fumantes.",
      },
    ],
    rooms: [
      room({
        name: "Studio Executivo",
        description:
          "Quarto compacto e silencioso com bancada ampla, cadeira ergonomica e cama queen.",
        imageUrl:
          "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama queen",
        sizeM2: 24,
        amenities: ["Mesa de trabalho", "Cadeira ergonomica", "Cofre", "Smart TV"],
        priceFrom: 610,
        units: 12,
      }),
      room({
        name: "Corner Premium",
        description:
          "Categoria de canto com area de estar, vista urbana e isolamento acustico reforcado.",
        imageUrl:
          "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama king",
        sizeM2: 36,
        amenities: ["Area de estar", "Cafeteira", "Isolamento acustico", "Roupao"],
        priceFrom: 830,
        units: 7,
      }),
    ],
  },
  {
    slug: "lph-boa-viagem-praia",
    name: "LPH Boa Viagem Praia",
    shortDescription:
      "Hotel proximo ao mar em Recife, com estrutura leve para familias e viagens a trabalho.",
    fullDescription:
      "O LPH Boa Viagem Praia entrega uma estadia pratica a poucos passos da orla, com piscina, restaurante e quartos preparados para diferentes perfis de viagem. A equipe apoia consultas de disponibilidade, eventos pequenos e roteiros locais.",
    city: "Recife",
    state: "PE",
    address: "Avenida Boa Viagem, 1890 - Boa Viagem, Recife - PE",
    phone: "(81) 3321-6789",
    email: "reservas.boaviagem@lphhoteis.com.br",
    whatsapp: "(81) 99771-6644",
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
        alt: "Area externa de hotel proxima ao litoral",
      },
      {
        url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
        alt: "Piscina com espreguicadeiras e vegetacao",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Lobby de hotel com recepcao moderna",
      },
    ],
    amenities: [
      "Piscina",
      "Servico de praia",
      "Espaco kids",
      "Restaurante",
      "Wi-Fi",
      "Sala para eventos pequenos",
    ],
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito ate 5 dias antes da chegada.",
      },
      {
        title: "Cafe da manha",
        description: "Cafe da manha incluido nas tarifas publicas demonstrativas.",
      },
      {
        title: "Areas de lazer",
        description: "Piscina e espaco kids funcionam diariamente ate as 22h.",
      },
    ],
    rooms: [
      room({
        name: "Superior Orla",
        description:
          "Quarto com cama queen, decoracao clara e vista lateral para a praia de Boa Viagem.",
        imageUrl:
          "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama queen",
        sizeM2: 28,
        amenities: ["Vista lateral", "Wi-Fi", "Frigobar", "Secador"],
        priceFrom: 560,
        units: 9,
      }),
      room({
        name: "Familia Praia",
        description:
          "Acomodacao com cama queen e bicama, indicada para familias que buscam praticidade.",
        imageUrl:
          "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        children: 2,
        beds: "1x Cama queen | 1x Beliche",
        sizeM2: 39,
        amenities: ["Bicama", "Berco sob pedido", "Smart TV", "Espaco para malas"],
        priceFrom: 720,
        units: 6,
      }),
    ],
  },
  {
    slug: "lph-lago-sul-brasilia",
    name: "LPH Lago Sul Brasilia",
    shortDescription:
      "Hospedagem discreta em Brasilia, com facil acesso ao aeroporto e areas institucionais.",
    fullDescription:
      "O LPH Lago Sul Brasilia atende viajantes que procuram tranquilidade, deslocamentos rapidos e um servico objetivo. Os quartos priorizam conforto acustico, as areas comuns recebem pequenas reunioes e o restaurante trabalha com menu enxuto durante todo o dia.",
    city: "Brasilia",
    state: "DF",
    address: "SHIS QI 12, Conjunto 3 - Lago Sul, Brasilia - DF",
    phone: "(61) 3344-2211",
    email: "reservas.lagosul@lphhoteis.com.br",
    whatsapp: "(61) 99876-5500",
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
        alt: "Area social com poltronas e iluminacao suave",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Quarto com varanda e luz natural",
      },
      {
        url: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
        alt: "Suite executiva com design contemporaneo",
      },
    ],
    amenities: [
      "Transfer executivo",
      "Sala de reunioes",
      "Piscina com deck",
      "Lavanderia",
      "Restaurante",
      "Estacionamento",
    ],
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento sem custo ate 72 horas antes da chegada.",
      },
      {
        title: "Transfer",
        description: "Transfer deve ser solicitado com antecedencia minima de 24 horas.",
      },
      {
        title: "Servicos extras",
        description: "Consumos adicionais sao conferidos e fechados no check-out.",
      },
    ],
    rooms: [
      room({
        name: "Business Prime",
        description:
          "Quarto para agenda executiva, com cama queen, mesa de trabalho e isolamento acustico.",
        imageUrl:
          "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama queen",
        sizeM2: 27,
        amenities: ["Mesa de trabalho", "Cofre", "Wi-Fi premium", "Cortina blackout"],
        priceFrom: 640,
        units: 10,
      }),
      room({
        name: "Suite Lago",
        description:
          "Suite com sala compacta, cama king e varanda voltada para a area verde do hotel.",
        imageUrl:
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        children: 1,
        beds: "1x Cama king | 1x Sofa-cama",
        sizeM2: 40,
        amenities: ["Varanda", "Sala compacta", "Cafeteira", "Roupao"],
        priceFrom: 870,
        units: 5,
      }),
    ],
  },
];

const legacyDemoSlugs = [
  "pousada-charle-brown",
  "lph-serra-imperial",
  "lph-jardins",
  "lph-lago-sul",
  "lph-boa-viagem",
  "lph-pelourinho",
  "lph-gramado-village",
  "lph-beira-mar",
];

function getSeedUserConfig() {
  return {
    superAdmin: {
      name: "Super Admin Staging",
      email:
        process.env.SEED_STAGING_SUPER_ADMIN_EMAIL?.trim().toLowerCase() ||
        process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ||
        "super.admin.staging@lphhoteis.local",
      password:
        process.env.SEED_STAGING_SUPER_ADMIN_PASSWORD?.trim() ||
        process.env.SEED_ADMIN_PASSWORD?.trim(),
    },
    hotelAdmin: {
      name: "Hotel Admin Staging",
      email:
        process.env.SEED_STAGING_HOTEL_ADMIN_EMAIL?.trim().toLowerCase() ||
        "hotel.admin.staging@lphhoteis.local",
      password: process.env.SEED_STAGING_HOTEL_ADMIN_PASSWORD?.trim(),
      hotelSlug: process.env.SEED_STAGING_HOTEL_ADMIN_HOTEL_SLUG?.trim() || hotels[0].slug,
    },
  };
}

function assertSeedPassword(label, password) {
  if (!password) {
    return false;
  }

  if (password.length < 12) {
    throw new Error(`${label} deve ter pelo menos 12 caracteres.`);
  }

  return true;
}

async function upsertSeedAdmin() {
  const { superAdmin, hotelAdmin } = getSeedUserConfig();

  if (assertSeedPassword("Senha do super admin de staging", superAdmin.password)) {
    const passwordHash = await bcrypt.hash(superAdmin.password, SALT_ROUNDS);

    await prisma.user.upsert({
      where: {
        email: superAdmin.email,
      },
      create: {
        name: superAdmin.name,
        email: superAdmin.email,
        passwordHash,
        globalRole: "super_admin",
        isActive: true,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
      update: {
        name: superAdmin.name,
        passwordHash,
        globalRole: "super_admin",
        isActive: true,
      },
    });
  }

  if (!assertSeedPassword("Senha do hotel admin de staging", hotelAdmin.password)) {
    return;
  }

  const hotel = await prisma.hotel.findUnique({
    where: {
      slug: hotelAdmin.hotelSlug,
    },
    select: {
      id: true,
    },
  });

  if (!hotel) {
    throw new Error(`Hotel do hotel_admin de staging nao encontrado: ${hotelAdmin.hotelSlug}`);
  }

  const hotelAdminPasswordHash = await bcrypt.hash(hotelAdmin.password, SALT_ROUNDS);

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: {
        email: hotelAdmin.email,
      },
      create: {
        name: hotelAdmin.name,
        email: hotelAdmin.email,
        passwordHash: hotelAdminPasswordHash,
        globalRole: "hotel_admin",
        isActive: true,
        twoFactorEnabled: false,
        twoFactorSecret: null,
      },
      update: {
        name: hotelAdmin.name,
        passwordHash: hotelAdminPasswordHash,
        globalRole: "hotel_admin",
        isActive: true,
      },
    });

    await tx.hotelPermission.deleteMany({
      where: {
        userId: user.id,
        hotelId: {
          not: hotel.id,
        },
      },
    });

    await tx.hotelPermission.upsert({
      where: {
        userId_hotelId: {
          userId: user.id,
          hotelId: hotel.id,
        },
      },
      create: {
        userId: user.id,
        hotelId: hotel.id,
        role: "admin",
      },
      update: {
        role: "admin",
      },
    });
  });
}

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
    isPublished: hotel.isPublished,
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
  await prisma.hotel.updateMany({
    where: {
      slug: {
        in: legacyDemoSlugs,
      },
    },
    data: {
      isPublished: false,
    },
  });

  for (const hotel of hotels) {
    await upsertHotel(hotel);
  }

  await upsertSeedAdmin();
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
