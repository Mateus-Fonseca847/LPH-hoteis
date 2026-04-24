const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();

const hotels = [
  {
    slug: "pousada-charle-brown",
    name: "Pousada Charle Brown",
    shortDescription: "Hospedagem leve perto do mar, ideal para dias tranquilos no litoral catarinense.",
    fullDescription:
      "A Pousada Charle Brown oferece uma experiência acolhedora, com clima descontraído, áreas externas agradáveis e acesso facilitado às praias e ao centrinho de Garopaba. A proposta combina conforto, boa localização e uma rotina simples para quem quer descansar com praticidade.",
    city: "Garopaba",
    state: "SC",
    address: "Rua das Conchas, 245 - Centro, Garopaba - SC",
    phone: "(48) 3254-1122",
    email: "reservas@charlebrown.lph.com.br",
    whatsapp: "(48) 99911-2233",
    coverImageUrl: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    latitude: "-28.0266000",
    longitude: "-48.6228000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
        alt: "Área externa com piscina e espreguiçadeiras",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Suíte clara com varanda e decoração clean",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Lobby de hotel com recepção elegante",
      },
    ],
    amenities: ["Piscina externa", "Café da manhã", "Wi-Fi", "Estacionamento", "Recepção 24h", "Espaço lounge"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito com até 5 dias de antecedência da chegada." },
      { title: "Crianças", description: "Uma criança de até 6 anos pode se hospedar sem custo na mesma acomodação." },
      { title: "Pets", description: "Aceitamos pets de pequeno porte mediante solicitação prévia." },
    ],
  },
  {
    slug: "lph-serra-imperial",
    name: "LPH Serra Imperial",
    shortDescription: "Refúgio serrano com atmosfera sofisticada e ritmo mais calmo em Petrópolis.",
    fullDescription:
      "O LPH Serra Imperial foi pensado para estadias de descanso em meio ao clima serrano, com espaços acolhedores, serviço atencioso e arquitetura que reforça a sensação de conforto. A localização permite aproveitar a cidade com tranquilidade, sem abrir mão de uma experiência elegante.",
    city: "Petrópolis",
    state: "RJ",
    address: "Avenida das Magnólias, 88 - Valparaíso, Petrópolis - RJ",
    phone: "(24) 2247-3300",
    email: "reservas@serraimperial.lph.com.br",
    whatsapp: "(24) 99820-4400",
    coverImageUrl: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "15:00",
    checkOutTime: "12:00",
    latitude: "-22.5055000",
    longitude: "-43.1782000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80",
        alt: "Fachada de hotel serrano com paisagismo",
      },
      {
        url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
        alt: "Quarto aconchegante com iluminação quente",
      },
      {
        url: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80",
        alt: "Lounge sofisticado de hotel de serra",
      },
    ],
    amenities: ["Piscina aquecida", "Spa", "Restaurante", "Adega", "Lareira no lobby", "Transfer sob demanda"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito com até 7 dias de antecedência." },
      { title: "Não fumantes", description: "Todas as suítes e áreas internas são destinadas a não fumantes." },
      { title: "Estacionamento", description: "Vagas disponíveis mediante confirmação no check-in." },
    ],
  },
  {
    slug: "lph-jardins",
    name: "LPH Jardins",
    shortDescription: "Hotel urbano com perfil contemporâneo em uma das regiões mais práticas da capital paulista.",
    fullDescription:
      "O LPH Jardins combina localização estratégica, visual clean e uma rotina de serviços pensada para quem circula por São Paulo com intensidade. A proposta atende tanto viagens de negócios quanto fins de semana mais urbanos, com suítes confortáveis e áreas comuns discretas e elegantes.",
    city: "São Paulo",
    state: "SP",
    address: "Alameda Bela Vista, 410 - Jardins, São Paulo - SP",
    phone: "(11) 3123-7800",
    email: "reservas@jardins.lph.com.br",
    whatsapp: "(11) 99888-7766",
    coverImageUrl: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "11:00",
    latitude: "-23.5614000",
    longitude: "-46.6565000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
        alt: "Suíte contemporânea com linhas minimalistas",
      },
      {
        url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
        alt: "Ambiente interno moderno com iluminação suave",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Recepção refinada de hotel urbano",
      },
    ],
    amenities: ["Academia", "Coworking", "Wi-Fi premium", "Valet", "Room service", "Bar intimista"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito até 48 horas antes do check-in." },
      { title: "Valet", description: "Serviço de valet disponível mediante cobrança adicional." },
      { title: "Animais", description: "Permitimos pets de pequeno porte em acomodações selecionadas." },
    ],
  },
  {
    slug: "lph-lago-sul",
    name: "LPH Lago Sul",
    shortDescription: "Hospedagem discreta e elegante em Brasília, com foco em conforto e praticidade.",
    fullDescription:
      "O LPH Lago Sul entrega uma experiência serena e funcional em uma das áreas mais valorizadas de Brasília. O hotel foi pensado para receber bem tanto viagens executivas quanto estadias de descanso, com espaços amplos, atendimento cuidadoso e atmosfera sofisticada.",
    city: "Brasília",
    state: "DF",
    address: "SHIS QI 12, Conjunto 3 - Lago Sul, Brasília - DF",
    phone: "(61) 3344-2211",
    email: "reservas@lagosul.lph.com.br",
    whatsapp: "(61) 99876-5500",
    coverImageUrl: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    latitude: "-15.8310000",
    longitude: "-47.8728000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80",
        alt: "Área social de hotel com poltronas e iluminação suave",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Quarto com varanda e vista ampla",
      },
      {
        url: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
        alt: "Suíte executiva com design contemporâneo",
      },
    ],
    amenities: ["Piscina com deck", "Sala de reuniões", "Concierge", "Lavanderia", "Café da manhã", "Transfer executivo"],
    policies: [
      { title: "Cancelamento", description: "Reembolso integral em cancelamentos com até 72 horas de antecedência." },
      { title: "Early check-in", description: "Disponível conforme ocupação do dia e confirmação prévia." },
      { title: "Serviços extras", description: "Consumos e serviços adicionais são fechados no check-out." },
    ],
  },
  {
    slug: "lph-boa-viagem",
    name: "LPH Boa Viagem",
    shortDescription: "Hotel à beira-mar em Recife com operação prática e clima acolhedor.",
    fullDescription:
      "O LPH Boa Viagem foi desenhado para quem quer aproveitar a orla recifense com conforto, acesso fácil e uma estrutura funcional. A hospedagem reúne quartos claros, equipe atenciosa e áreas de convivência ideais para estadias de lazer ou trabalho perto do mar.",
    city: "Recife",
    state: "PE",
    address: "Avenida Boa Viagem, 1890 - Boa Viagem, Recife - PE",
    phone: "(81) 3321-6789",
    email: "reservas@boaviagem.lph.com.br",
    whatsapp: "(81) 99771-6644",
    coverImageUrl: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    latitude: "-8.1268000",
    longitude: "-34.9007000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Lobby de hotel com recepção e iluminação moderna",
      },
      {
        url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
        alt: "Piscina com área de descanso e coqueiros",
      },
      {
        url: "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80",
        alt: "Área externa de hotel próxima ao litoral",
      },
    ],
    amenities: ["Vista para o mar", "Piscina", "Restaurante", "Wi-Fi", "Espaço kids", "Serviço de praia"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito até 5 dias antes da data de entrada." },
      { title: "Café da manhã", description: "Incluso em todas as tarifas públicas disponíveis no site." },
      { title: "Áreas de lazer", description: "As áreas de lazer funcionam até as 22h." },
    ],
  },
  {
    slug: "lph-pelourinho",
    name: "LPH Pelourinho",
    shortDescription: "Hospedagem com identidade cultural e clima acolhedor no centro histórico de Salvador.",
    fullDescription:
      "O LPH Pelourinho valoriza o ritmo, a arte e a arquitetura do centro histórico de Salvador em uma proposta de hospedagem confortável e contemporânea. O hotel foi pensado para quem quer explorar a cidade com proximidade dos principais roteiros culturais sem abrir mão de uma estadia agradável.",
    city: "Salvador",
    state: "BA",
    address: "Ladeira do Carmo, 57 - Pelourinho, Salvador - BA",
    phone: "(71) 3012-9088",
    email: "reservas@pelourinho.lph.com.br",
    whatsapp: "(71) 99630-4411",
    coverImageUrl: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "15:00",
    checkOutTime: "12:00",
    latitude: "-12.9714000",
    longitude: "-38.5109000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Quarto com varanda e decoração acolhedora",
      },
      {
        url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
        alt: "Rua histórica com atmosfera artística",
      },
      {
        url: "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1400&q=80",
        alt: "Ambiente noturno com clima intimista e cultural",
      },
    ],
    amenities: ["Terraço panorâmico", "Bar autoral", "Wi-Fi", "Café regional", "Concierge cultural", "Transfers"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito com até 7 dias de antecedência." },
      { title: "Silêncio", description: "Pedimos silêncio nas áreas comuns a partir das 23h." },
      { title: "Hospedagem infantil", description: "Acomodação de crianças sujeita à categoria reservada." },
    ],
  },
  {
    slug: "lph-gramado-village",
    name: "LPH Gramado Village",
    shortDescription: "Hotel serrano com clima intimista e proposta voltada para descanso e conforto.",
    fullDescription:
      "O LPH Gramado Village reúne aconchego, temperatura visual mais quente e uma experiência pensada para quem quer desacelerar na Serra Gaúcha. As acomodações priorizam conforto e a operação do hotel foi desenhada para tornar a estadia simples, agradável e acolhedora em qualquer época do ano.",
    city: "Gramado",
    state: "RS",
    address: "Rua das Hortênsias, 620 - Centro, Gramado - RS",
    phone: "(54) 3295-4433",
    email: "reservas@gramadovillage.lph.com.br",
    whatsapp: "(54) 99740-2288",
    coverImageUrl: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "15:00",
    checkOutTime: "11:00",
    latitude: "-29.3792000",
    longitude: "-50.8736000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
        alt: "Suíte acolhedora com cabeceira em madeira",
      },
      {
        url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80",
        alt: "Hotel serrano rodeado por jardim e clima frio",
      },
      {
        url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
        alt: "Ambiente interno moderno e confortável",
      },
    ],
    amenities: ["Lareira", "Spa", "Café colonial", "Sala de leitura", "Bicicletas", "Transfer local"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito até 10 dias antes da hospedagem." },
      { title: "Alta temporada", description: "Períodos sazonais podem ter condições especiais de alteração." },
      { title: "Pets", description: "Algumas acomodações recebem pets de pequeno porte." },
    ],
  },
  {
    slug: "lph-beira-mar",
    name: "LPH Beira-Mar",
    shortDescription: "Hospedagem de frente para a orla com visual leve e confortável em Florianópolis.",
    fullDescription:
      "O LPH Beira-Mar foi projetado para unir praticidade urbana e atmosfera de litoral, com vista privilegiada, áreas de convivência elegantes e quartos pensados para relaxar. A proposta atende bem tanto quem viaja a lazer quanto quem precisa de uma base confortável na capital catarinense.",
    city: "Florianópolis",
    state: "SC",
    address: "Avenida da Orla, 510 - Beira-Mar Norte, Florianópolis - SC",
    phone: "(48) 3211-8822",
    email: "reservas@beiramar.lph.com.br",
    whatsapp: "(48) 99651-7744",
    coverImageUrl: "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80",
    checkInTime: "14:00",
    checkOutTime: "12:00",
    latitude: "-27.5949000",
    longitude: "-48.5482000",
    isPublished: true,
    galleryImages: [
      {
        url: "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80",
        alt: "Área externa de hotel com vista para o mar",
      },
      {
        url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
        alt: "Piscina com borda e vegetação ao redor",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Suíte com luz natural e varanda",
      },
    ],
    amenities: ["Rooftop", "Piscina", "Academia", "Wi-Fi", "Café da manhã", "Bicicletário"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito até 72 horas antes do check-in." },
      { title: "Garagem", description: "Vagas sujeitas à disponibilidade no dia da chegada." },
      { title: "Manutenção", description: "Áreas de lazer podem fechar temporariamente para manutenção preventiva." },
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
    isPublished: hotel.isPublished,
  };

  const savedHotel = await prisma.hotel.upsert({
    where: { slug: hotel.slug },
    create: baseData,
    update: baseData,
  });

  await prisma.hotelImage.deleteMany({ where: { hotelId: savedHotel.id } });
  await prisma.hotelAmenity.deleteMany({ where: { hotelId: savedHotel.id } });
  await prisma.hotelPolicy.deleteMany({ where: { hotelId: savedHotel.id } });

  await prisma.hotelImage.createMany({
    data: hotel.galleryImages.map((image, index) => ({
      hotelId: savedHotel.id,
      url: image.url,
      alt: image.alt,
      position: index,
    })),
  });

  await prisma.hotelAmenity.createMany({
    data: hotel.amenities.map((label, index) => ({
      hotelId: savedHotel.id,
      label,
      position: index,
    })),
  });

  await prisma.hotelPolicy.createMany({
    data: hotel.policies.map((policy, index) => ({
      hotelId: savedHotel.id,
      title: policy.title,
      description: policy.description,
      position: index,
    })),
  });
}

async function main() {
  for (const hotel of hotels) {
    await upsertHotel(hotel);
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
