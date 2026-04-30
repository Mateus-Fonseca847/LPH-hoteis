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
      name: "Tarifa flexível",
      description:
        "Tarifa com café da manhã incluído e alteração permitida conforme disponibilidade.",
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
        "Condição promocional para reservas planejadas, com pagamento antecipado e menor tarifa.",
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
    slug: "lph-marina-santos",
    name: "LPH Marina Santos",
    shortDescription:
      "Hotel urbano de frente para a marina, com rotina pratica para lazer e viagens corporativas.",
    fullDescription:
      "O LPH Marina Santos combina vista para o canal, ambientes claros e serviços pensados para estadias curtas ou prolongadas. A operação atende bem quem precisa circular pela Baixada Santista sem abrir mão de conforto, boa gastronomia e apoio de concierge.",
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
        alt: "Piscina externa com espreguiçadeiras e fachada do hotel",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Suíte clara com cama ampla e varanda",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Recepção contemporânea com área de espera",
      },
    ],
    amenities: [
      "Piscina com deck",
      "Restaurante autoral",
      "Wi-Fi de alta velocidade",
      "Sala de reuniões",
      "Estacionamento com manobrista",
      "Concierge",
    ],
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento sem custo até 72 horas antes da chegada.",
      },
      {
        title: "Crianças",
        description: "Crianças são bem-vindas e podem usar cama extra mediante confirmação.",
      },
      {
        title: "Estacionamento",
        description: "Vagas sujeitas a disponibilidade, com cobrança diária informada no check-in.",
      },
    ],
    rooms: [
      room({
        name: "Executivo Marina",
        description:
          "Quarto funcional com bancada de trabalho, boa iluminação natural e vista lateral para a marina.",
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
        name: "Suíte Frente Mar",
        description:
          "Acomodação mais ampla com sala compacta, varanda mobiliada e enxoval premium.",
        imageUrl:
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        children: 1,
        beds: "1x Cama king | 1x Sofá-cama",
        sizeM2: 42,
        amenities: ["Varanda", "Vista para a marina", "Cafeteira", "Roupão"],
        priceFrom: 760,
        units: 4,
      }),
    ],
  },
  {
    slug: "lph-serra-dos-araucarias",
    name: "LPH Serra dos Araucárias",
    shortDescription:
      "Refúgio serrano com clima reservado, lareira e estrutura para fins de semana de descanso.",
    fullDescription:
      "O LPH Serra dos Araucárias oferece uma experiência acolhedora na Serra Gaúcha, com quartos silenciosos, restaurante de ingredientes locais e áreas sociais voltadas ao descanso. A proposta equilibra conforto, natureza e atendimento próximo.",
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
        alt: "Lounge com poltronas e iluminação quente",
      },
    ],
    amenities: [
      "Lareira no lobby",
      "Restaurante regional",
      "Spa compacto",
      "Trilhas guiadas",
      "Café colonial",
      "Estacionamento",
    ],
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito até 7 dias antes da hospedagem.",
      },
      {
        title: "Pets",
        description: "Pets de pequeno porte são aceitos em categorias selecionadas.",
      },
      {
        title: "Silêncio",
        description: "Áreas externas seguem horário de silêncio a partir das 22h.",
      },
    ],
    rooms: [
      room({
        name: "Chalé Jardim",
        description: "Quarto com varanda para o jardim, calefação e composição ideal para casais.",
        imageUrl:
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama king",
        sizeM2: 31,
        amenities: ["Calefação", "Varanda", "Smart TV", "Amenities premium"],
        priceFrom: 690,
        units: 6,
      }),
      room({
        name: "Suíte Família Serra",
        description:
          "Suíte com dois ambientes, sofá-cama e espaço adicional para famílias em estadias de lazer.",
        imageUrl:
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        children: 2,
        beds: "1x Cama queen | 2x Cama de solteiro",
        sizeM2: 46,
        amenities: ["Dois ambientes", "Berço sob pedido", "Frigobar", "Vista para o bosque"],
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
      "O LPH Jardins Business foi desenhado para quem precisa de localização central em São Paulo, check-in ágil e ambientes confortáveis para trabalhar ou descansar. A estrutura inclui coworking reservado, room service e conexão fácil aos principais corredores da cidade.",
    city: "São Paulo",
    state: "SP",
    address: "Alameda Lorena, 870 - Jardins, São Paulo - SP",
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
        alt: "Suíte urbana com decoração contemporânea",
      },
      {
        url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
        alt: "Ambiente interno moderno com luz natural",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Lobby com recepção e área de espera",
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
        description: "Cancelamento sem custo até 48 horas antes do check-in.",
      },
      {
        title: "Check-in antecipado",
        description: "Disponível mediante ocupação do dia e confirmação prévia.",
      },
      {
        title: "Não fumantes",
        description: "Todos os quartos e áreas internas são ambientes não fumantes.",
      },
    ],
    rooms: [
      room({
        name: "Studio Executivo",
        description:
          "Quarto compacto e silencioso com bancada ampla, cadeira ergonômica e cama queen.",
        imageUrl:
          "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama queen",
        sizeM2: 24,
        amenities: ["Mesa de trabalho", "Cadeira ergonômica", "Cofre", "Smart TV"],
        priceFrom: 610,
        units: 12,
      }),
      room({
        name: "Corner Premium",
        description:
          "Categoria de canto com área de estar, vista urbana e isolamento acústico reforçado.",
        imageUrl:
          "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        beds: "1x Cama king",
        sizeM2: 36,
        amenities: ["Área de estar", "Cafeteira", "Isolamento acústico", "Roupão"],
        priceFrom: 830,
        units: 7,
      }),
    ],
  },
  {
    slug: "lph-boa-viagem-praia",
    name: "LPH Boa Viagem Praia",
    shortDescription:
      "Hotel próximo ao mar em Recife, com estrutura leve para famílias e viagens a trabalho.",
    fullDescription:
      "O LPH Boa Viagem Praia entrega uma estadia prática a poucos passos da orla, com piscina, restaurante e quartos preparados para diferentes perfis de viagem. A equipe apoia consultas de disponibilidade, eventos pequenos e roteiros locais.",
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
        alt: "Área externa de hotel próxima ao litoral",
      },
      {
        url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
        alt: "Piscina com espreguiçadeiras e vegetação",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Lobby de hotel com recepção moderna",
      },
    ],
    amenities: [
      "Piscina",
      "Serviço de praia",
      "Espaço kids",
      "Restaurante",
      "Wi-Fi",
      "Sala para eventos pequenos",
    ],
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito até 5 dias antes da chegada.",
      },
      {
        title: "Café da manhã",
        description: "Café da manhã incluído nas tarifas públicas demonstrativas.",
      },
      {
        title: "Áreas de lazer",
        description: "Piscina e espaço kids funcionam diariamente até as 22h.",
      },
    ],
    rooms: [
      room({
        name: "Superior Orla",
        description:
          "Quarto com cama queen, decoração clara e vista lateral para a praia de Boa Viagem.",
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
        name: "Família Praia",
        description:
          "Acomodação com cama queen e bicama, indicada para famílias que buscam praticidade.",
        imageUrl:
          "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        children: 2,
        beds: "1x Cama queen | 1x Beliche",
        sizeM2: 39,
        amenities: ["Bicama", "Berço sob pedido", "Smart TV", "Espaço para malas"],
        priceFrom: 720,
        units: 6,
      }),
    ],
  },
  {
    slug: "lph-lago-sul-brasilia",
    name: "LPH Lago Sul Brasília",
    shortDescription:
      "Hospedagem discreta em Brasília, com fácil acesso ao aeroporto e áreas institucionais.",
    fullDescription:
      "O LPH Lago Sul Brasília atende viajantes que procuram tranquilidade, deslocamentos rápidos e um serviço objetivo. Os quartos priorizam conforto acústico, as áreas comuns recebem pequenas reuniões e o restaurante trabalha com menu enxuto durante todo o dia.",
    city: "Brasília",
    state: "DF",
    address: "SHIS QI 12, Conjunto 3 - Lago Sul, Brasília - DF",
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
        alt: "Área social com poltronas e iluminação suave",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Quarto com varanda e luz natural",
      },
      {
        url: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
        alt: "Suíte executiva com design contemporâneo",
      },
    ],
    amenities: [
      "Transfer executivo",
      "Sala de reuniões",
      "Piscina com deck",
      "Lavanderia",
      "Restaurante",
      "Estacionamento",
    ],
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento sem custo até 72 horas antes da chegada.",
      },
      {
        title: "Transfer",
        description: "Transfer deve ser solicitado com antecedência mínima de 24 horas.",
      },
      {
        title: "Serviços extras",
        description: "Consumos adicionais são conferidos e fechados no check-out.",
      },
    ],
    rooms: [
      room({
        name: "Business Prime",
        description:
          "Quarto para agenda executiva, com cama queen, mesa de trabalho e isolamento acústico.",
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
        name: "Suíte Lago",
        description:
          "Suíte com sala compacta, cama king e varanda voltada para a área verde do hotel.",
        imageUrl:
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
        adults: 2,
        children: 1,
        beds: "1x Cama king | 1x Sofá-cama",
        sizeM2: 40,
        amenities: ["Varanda", "Sala compacta", "Cafeteira", "Roupão"],
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
      name: "Administrador Geral LPH",
      email:
        process.env.SEED_STAGING_SUPER_ADMIN_EMAIL?.trim().toLowerCase() ||
        process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() ||
        "super.admin.staging@lphhoteis.local",
      password:
        process.env.SEED_STAGING_SUPER_ADMIN_PASSWORD?.trim() ||
        process.env.SEED_ADMIN_PASSWORD?.trim(),
    },
    hotelAdmin: {
      name: "Administrador do Hotel",
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
    throw new Error(`Hotel do hotel_admin de staging não encontrado: ${hotelAdmin.hotelSlug}`);
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
