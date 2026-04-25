const { PrismaClient, Prisma } = require("@prisma/client");

const prisma = new PrismaClient();

function buildRooms(prefix, fallbackImage, rooms) {
  return rooms.map((room) => ({
    name: `${prefix} ${room.name}`,
    description: room.description,
    imageUrl: room.imageUrl || fallbackImage,
    capacity: room.capacity,
    beds: room.beds,
    size: room.size,
    priceFrom: room.priceFrom,
    isAvailable: room.isAvailable,
  }));
}

const hotels = [
  {
    slug: "pousada-charle-brown",
    name: "Pousada Charle Brown",
    shortDescription: "Hospedagem leve perto do mar, ideal para dias tranquilos no litoral catarinense.",
    fullDescription:
      "A Pousada Charle Brown oferece uma experiencia acolhedora, com clima descontraido, areas externas agradaveis e acesso facilitado as praias e ao centrinho de Garopaba.",
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
        alt: "Area externa com piscina e espreguicadeiras",
      },
      {
        url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
        alt: "Suite clara com varanda e decoracao clean",
      },
      {
        url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
        alt: "Lobby de hotel com recepcao elegante",
      },
    ],
    amenities: ["Piscina externa", "Cafe da manha", "Wi-Fi", "Estacionamento", "Recepcao 24h", "Espaco lounge"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito com ate 5 dias de antecedencia da chegada." },
      { title: "Criancas", description: "Uma crianca de ate 6 anos pode se hospedar sem custo na mesma acomodacao." },
      { title: "Pets", description: "Aceitamos pets de pequeno porte mediante solicitacao previa." },
    ],
    rooms: buildRooms("Charle Brown", "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80", [
      {
        name: "Suite Praia",
        description: "Quarto funcional com varanda e atmosfera leve para estadias perto do mar.",
        capacity: 2,
        beds: "1 cama queen",
        size: "26 m2",
        priceFrom: "420.00",
        isAvailable: true,
      },
      {
        name: "Familia Jardim",
        description: "Acomodacao com espaco extra para viagens em familia e estadias mais longas.",
        capacity: 4,
        beds: "1 cama queen + 2 solteiro",
        size: "38 m2",
        priceFrom: "610.00",
        isAvailable: true,
      },
    ]),
  },
  {
    slug: "lph-serra-imperial",
    name: "LPH Serra Imperial",
    shortDescription: "Refugio serrano com atmosfera sofisticada e ritmo mais calmo em Petropolis.",
    fullDescription:
      "O LPH Serra Imperial foi pensado para estadias de descanso em meio ao clima serrano, com espacos acolhedores, servico atencioso e arquitetura que reforca a sensacao de conforto.",
    city: "Petropolis",
    state: "RJ",
    address: "Avenida das Magnolias, 88 - Valparaiso, Petropolis - RJ",
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
      { url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80", alt: "Fachada de hotel serrano com paisagismo" },
      { url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80", alt: "Quarto aconchegante com iluminacao quente" },
      { url: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80", alt: "Lounge sofisticado de hotel de serra" },
    ],
    amenities: ["Piscina aquecida", "Spa", "Restaurante", "Adega", "Lareira no lobby", "Transfer sob demanda"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito com ate 7 dias de antecedencia." },
      { title: "Nao fumantes", description: "Todas as suites e areas internas sao destinadas a nao fumantes." },
      { title: "Estacionamento", description: "Vagas disponiveis mediante confirmacao no check-in." },
    ],
    rooms: buildRooms("Serra Imperial", "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80", [
      {
        name: "Classica Serra",
        description: "Suite acolhedora com texturas quentes e clima de descanso em meio a serra.",
        capacity: 2,
        beds: "1 cama king",
        size: "30 m2",
        priceFrom: "690.00",
        isAvailable: true,
      },
      {
        name: "Imperial Lounge",
        description: "Quarto amplo com area de estar e proposta mais reservada para fins de semana tranquilos.",
        capacity: 3,
        beds: "1 cama king + sofa-cama",
        size: "42 m2",
        priceFrom: "880.00",
        isAvailable: false,
      },
    ]),
  },
  {
    slug: "lph-jardins",
    name: "LPH Jardins",
    shortDescription: "Hotel urbano com perfil contemporaneo em uma das regioes mais praticas da capital paulista.",
    fullDescription:
      "O LPH Jardins combina localizacao estrategica, visual clean e uma rotina de servicos pensada para quem circula por Sao Paulo com intensidade.",
    city: "Sao Paulo",
    state: "SP",
    address: "Alameda Bela Vista, 410 - Jardins, Sao Paulo - SP",
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
      { url: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80", alt: "Suite contemporanea com linhas minimalistas" },
      { url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80", alt: "Ambiente interno moderno com iluminacao suave" },
      { url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80", alt: "Recepcao refinada de hotel urbano" },
    ],
    amenities: ["Academia", "Coworking", "Wi-Fi premium", "Valet", "Room service", "Bar intimista"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito ate 48 horas antes do check-in." },
      { title: "Valet", description: "Servico de valet disponivel mediante cobranca adicional." },
      { title: "Animais", description: "Permitimos pets de pequeno porte em acomodacoes selecionadas." },
    ],
    rooms: buildRooms("Jardins", "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80", [
      {
        name: "Executivo Urbano",
        description: "Configuracao pratica para viagens de negocios com boa bancada e conforto visual.",
        capacity: 2,
        beds: "1 cama queen",
        size: "24 m2",
        priceFrom: "740.00",
        isAvailable: true,
      },
      {
        name: "Corner Select",
        description: "Categoria superior com area adicional e atmosfera silenciosa em meio a rotina paulistana.",
        capacity: 2,
        beds: "1 cama king",
        size: "34 m2",
        priceFrom: "960.00",
        isAvailable: true,
      },
    ]),
  },
  {
    slug: "lph-lago-sul",
    name: "LPH Lago Sul",
    shortDescription: "Hospedagem discreta e elegante em Brasilia, com foco em conforto e praticidade.",
    fullDescription:
      "O LPH Lago Sul entrega uma experiencia serena e funcional em uma das areas mais valorizadas de Brasilia.",
    city: "Brasilia",
    state: "DF",
    address: "SHIS QI 12, Conjunto 3 - Lago Sul, Brasilia - DF",
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
      { url: "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80", alt: "Area social de hotel com poltronas e iluminacao suave" },
      { url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80", alt: "Quarto com varanda e vista ampla" },
      { url: "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80", alt: "Suite executiva com design contemporaneo" },
    ],
    amenities: ["Piscina com deck", "Sala de reunioes", "Concierge", "Lavanderia", "Cafe da manha", "Transfer executivo"],
    policies: [
      { title: "Cancelamento", description: "Reembolso integral em cancelamentos com ate 72 horas de antecedencia." },
      { title: "Early check-in", description: "Disponivel conforme ocupacao do dia e confirmacao previa." },
      { title: "Servicos extras", description: "Consumos e servicos adicionais sao fechados no check-out." },
    ],
    rooms: buildRooms("Lago Sul", "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80", [
      {
        name: "Business Prime",
        description: "Quarto versatil para estadias executivas com apoio funcional e atmosfera discreta.",
        capacity: 2,
        beds: "1 cama queen",
        size: "27 m2",
        priceFrom: "680.00",
        isAvailable: true,
      },
      {
        name: "Vista Lago",
        description: "Categoria com espaco adicional e proposta mais confortavel para estadias prolongadas.",
        capacity: 3,
        beds: "1 cama king + 1 auxiliar",
        size: "39 m2",
        priceFrom: "890.00",
        isAvailable: true,
      },
    ]),
  },
  {
    slug: "lph-boa-viagem",
    name: "LPH Boa Viagem",
    shortDescription: "Hotel a beira-mar em Recife com operacao pratica e clima acolhedor.",
    fullDescription:
      "O LPH Boa Viagem foi desenhado para quem quer aproveitar a orla recifense com conforto, acesso facil e uma estrutura funcional.",
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
      { url: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80", alt: "Lobby de hotel com recepcao e iluminacao moderna" },
      { url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80", alt: "Piscina com area de descanso e coqueiros" },
      { url: "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80", alt: "Area externa de hotel proxima ao litoral" },
    ],
    amenities: ["Vista para o mar", "Piscina", "Restaurante", "Wi-Fi", "Espaco kids", "Servico de praia"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito ate 5 dias antes da data de entrada." },
      { title: "Cafe da manha", description: "Incluso em todas as tarifas publicas disponiveis no site." },
      { title: "Areas de lazer", description: "As areas de lazer funcionam ate as 22h." },
    ],
    rooms: buildRooms("Boa Viagem", "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1200&q=80", [
      {
        name: "Mar Frontal",
        description: "Acomodacao com foco em vista e conforto para dias leves perto da orla.",
        capacity: 2,
        beds: "1 cama queen",
        size: "28 m2",
        priceFrom: "590.00",
        isAvailable: true,
      },
      {
        name: "Familia Orla",
        description: "Quarto pratico com distribuicao pensada para viagens de grupo pequeno.",
        capacity: 4,
        beds: "1 cama queen + bicama",
        size: "36 m2",
        priceFrom: "770.00",
        isAvailable: false,
      },
    ]),
  },
  {
    slug: "lph-pelourinho",
    name: "LPH Pelourinho",
    shortDescription: "Hospedagem com identidade cultural e clima acolhedor no centro historico de Salvador.",
    fullDescription:
      "O LPH Pelourinho valoriza o ritmo, a arte e a arquitetura do centro historico de Salvador em uma proposta de hospedagem confortavel e contemporanea.",
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
      { url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80", alt: "Quarto com varanda e decoracao acolhedora" },
      { url: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80", alt: "Rua historica com atmosfera artistica" },
      { url: "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1400&q=80", alt: "Ambiente noturno com clima intimista e cultural" },
    ],
    amenities: ["Terraco panoramico", "Bar autoral", "Wi-Fi", "Cafe regional", "Concierge cultural", "Transfers"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito com ate 7 dias de antecedencia." },
      { title: "Silencio", description: "Pedimos silencio nas areas comuns a partir das 23h." },
      { title: "Hospedagem infantil", description: "Acomodacao de criancas sujeita a categoria reservada." },
    ],
    rooms: buildRooms("Pelourinho", "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80", [
      {
        name: "Historica",
        description: "Quarto com identidade cultural e ambientacao acolhedora no centro historico.",
        capacity: 2,
        beds: "1 cama queen",
        size: "25 m2",
        priceFrom: "560.00",
        isAvailable: true,
      },
      {
        name: "Varanda Cultural",
        description: "Categoria com varanda e clima intimista para explorar Salvador com conforto.",
        capacity: 3,
        beds: "1 cama queen + 1 solteiro",
        size: "33 m2",
        priceFrom: "720.00",
        isAvailable: true,
      },
    ]),
  },
  {
    slug: "lph-gramado-village",
    name: "LPH Gramado Village",
    shortDescription: "Hotel serrano com clima intimista e proposta voltada para descanso e conforto.",
    fullDescription:
      "O LPH Gramado Village reune aconchego, temperatura visual mais quente e uma experiencia pensada para quem quer desacelerar na Serra Gaucha.",
    city: "Gramado",
    state: "RS",
    address: "Rua das Hortensias, 620 - Centro, Gramado - RS",
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
      { url: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80", alt: "Suite acolhedora com cabeceira em madeira" },
      { url: "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80", alt: "Hotel serrano rodeado por jardim e clima frio" },
      { url: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80", alt: "Ambiente interno moderno e confortavel" },
    ],
    amenities: ["Lareira", "Spa", "Cafe colonial", "Sala de leitura", "Bicicletas", "Transfer local"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito ate 10 dias antes da hospedagem." },
      { title: "Alta temporada", description: "Periodos sazonais podem ter condicoes especiais de alteracao." },
      { title: "Pets", description: "Algumas acomodacoes recebem pets de pequeno porte." },
    ],
    rooms: buildRooms("Gramado Village", "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80", [
      {
        name: "Serra Aconchego",
        description: "Suite com temperatura visual quente e foco em descanso na Serra Gaucha.",
        capacity: 2,
        beds: "1 cama king",
        size: "29 m2",
        priceFrom: "730.00",
        isAvailable: true,
      },
      {
        name: "Village Familia",
        description: "Opcao com layout mais amplo para viagens em familia e estadias sazonais.",
        capacity: 4,
        beds: "1 cama queen + 2 solteiro",
        size: "41 m2",
        priceFrom: "980.00",
        isAvailable: true,
      },
    ]),
  },
  {
    slug: "lph-beira-mar",
    name: "LPH Beira-Mar",
    shortDescription: "Hospedagem de frente para a orla com visual leve e confortavel em Florianopolis.",
    fullDescription:
      "O LPH Beira-Mar foi projetado para unir praticidade urbana e atmosfera de litoral, com vista privilegiada, areas de convivencia elegantes e quartos pensados para relaxar.",
    city: "Florianopolis",
    state: "SC",
    address: "Avenida da Orla, 510 - Beira-Mar Norte, Florianopolis - SC",
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
      { url: "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80", alt: "Area externa de hotel com vista para o mar" },
      { url: "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80", alt: "Piscina com borda e vegetacao ao redor" },
      { url: "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80", alt: "Suite com luz natural e varanda" },
    ],
    amenities: ["Rooftop", "Piscina", "Academia", "Wi-Fi", "Cafe da manha", "Bicicletario"],
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito ate 72 horas antes do check-in." },
      { title: "Garagem", description: "Vagas sujeitas a disponibilidade no dia da chegada." },
      { title: "Manutencao", description: "Areas de lazer podem fechar temporariamente para manutencao preventiva." },
    ],
    rooms: buildRooms("Beira-Mar", "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1200&q=80", [
      {
        name: "Vista Mar",
        description: "Categoria com vista privilegiada e proposta leve para estadias a beira-mar.",
        capacity: 2,
        beds: "1 cama king",
        size: "31 m2",
        priceFrom: "650.00",
        isAvailable: true,
      },
      {
        name: "Residence Premium",
        description: "Acomodacao mais ampla para quem busca espaco adicional e conforto prolongado.",
        capacity: 3,
        beds: "1 cama king + sofa-cama",
        size: "44 m2",
        priceFrom: "910.00",
        isAvailable: false,
      },
    ]),
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
  await prisma.hotelRoom.deleteMany({ where: { hotelId: savedHotel.id } });
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

  await prisma.hotelRoom.createMany({
    data: hotel.rooms.map((room) => ({
      hotelId: savedHotel.id,
      name: room.name,
      description: room.description,
      imageUrl: room.imageUrl,
      capacity: room.capacity,
      beds: room.beds,
      size: room.size,
      priceFrom: new Prisma.Decimal(room.priceFrom),
      isAvailable: room.isAvailable,
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
