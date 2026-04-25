export type HotelContact = {
  phone: string;
  email: string;
  whatsapp: string;
};

export type HotelPolicy = {
  title: string;
  description: string;
};

export type Hotel = {
  slug: string;
  name: string;
  shortDescription: string;
  fullDescription: string;
  city: string;
  state: string;
  address: string;
  image: string;
  alt: string;
  gallery: string[];
  amenities: string[];
  contacts: HotelContact;
  policies: HotelPolicy[];
  checkIn: string;
  checkOut: string;
};

export const hotels: Hotel[] = [
  {
    slug: "pousada-charle-brown",
    name: "Pousada Charle Brown",
    shortDescription: "Refúgio descontraído perto da praia, com clima leve e atmosfera acolhedora.",
    fullDescription:
      "A Pousada Charle Brown combina a energia do litoral catarinense com uma hospedagem confortável e descomplicada. A poucos minutos da praia, oferece áreas de descanso ao ar livre, piscina cercada por vegetação e quartos pensados para quem quer relaxar com praticidade, charme e boa localização em Garopaba.",
    city: "Garopaba",
    state: "SC",
    address: "Rua das Ondas, 245 - Centro, Garopaba - SC",
    image:
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
    alt: "Fachada de hotel com piscina e palmeiras",
    gallery: [
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
    ],
    amenities: [
      "Piscina externa",
      "Café da manhã",
      "Wi-Fi",
      "Estacionamento",
      "Recepção 24h",
      "Espaço lounge",
    ],
    contacts: {
      phone: "(48) 3254-1122",
      email: "reservas@lphcharlebrown.com.br",
      whatsapp: "(48) 99911-2233",
    },
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito com até 5 dias de antecedência.",
      },
      {
        title: "Crianças",
        description: "Crianças de até 6 anos têm cortesia na mesma acomodação dos responsáveis.",
      },
      { title: "Pets", description: "Aceitamos pets de pequeno porte mediante consulta prévia." },
    ],
    checkIn: "14:00",
    checkOut: "12:00",
  },
  {
    slug: "serra-imperial",
    name: "Serra Imperial",
    shortDescription: "Hospedagem clássica na serra com clima sofisticado e vista para a natureza.",
    fullDescription:
      "O Serra Imperial foi pensado para quem busca elegância e tranquilidade em Petrópolis. Com arquitetura inspirada no charme serrano, áreas comuns acolhedoras e atendimento dedicado, o hotel entrega uma experiência refinada para escapadas românticas, viagens em família e fins de semana mais tranquilos na região imperial.",
    city: "Petrópolis",
    state: "RJ",
    address: "Avenida Imperial, 88 - Valparaíso, Petrópolis - RJ",
    image:
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80",
    alt: "Hotel em região serrana com arquitetura clássica",
    gallery: [
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
    ],
    amenities: [
      "Lareira no lobby",
      "Spa",
      "Restaurante",
      "Piscina aquecida",
      "Adega",
      "Transfer sob demanda",
    ],
    contacts: {
      phone: "(24) 2247-3300",
      email: "reservas@serraimperial.com.br",
      whatsapp: "(24) 99820-4400",
    },
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito com até 7 dias de antecedência.",
      },
      { title: "Fumantes", description: "Todas as acomodações são para não fumantes." },
      {
        title: "Eventos",
        description: "Pequenos eventos privativos disponíveis mediante reserva.",
      },
    ],
    checkIn: "15:00",
    checkOut: "12:00",
  },
  {
    slug: "jardins-select",
    name: "Jardins Select",
    shortDescription:
      "Endereço contemporâneo no coração de São Paulo para viagens urbanas com estilo.",
    fullDescription:
      "Com design limpo e localização estratégica, o Jardins Select atende quem quer explorar São Paulo com conforto e agilidade. Próximo a restaurantes, lojas e centros culturais, oferece suítes modernas, áreas de convivência elegantes e uma proposta de hospedagem urbana alinhada ao ritmo da cidade.",
    city: "São Paulo",
    state: "SP",
    address: "Alameda Prime, 410 - Jardins, São Paulo - SP",
    image:
      "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
    alt: "Quarto de hotel moderno e elegante",
    gallery: [
      "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
    ],
    amenities: ["Academia", "Coworking", "Room service", "Wi-Fi premium", "Valet", "Bar de vinhos"],
    contacts: {
      phone: "(11) 3123-7800",
      email: "reservas@jardinsselect.com.br",
      whatsapp: "(11) 99888-7766",
    },
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito até 48 horas antes do check-in.",
      },
      {
        title: "Estacionamento",
        description: "Serviço de valet disponível mediante cobrança adicional.",
      },
      { title: "Animais", description: "Pet friendly para animais de pequeno porte." },
    ],
    checkIn: "14:00",
    checkOut: "11:00",
  },
  {
    slug: "lago-sul-prime",
    name: "Lago Sul Prime",
    shortDescription:
      "Hotel de atmosfera serena em Brasília, com conforto executivo e lazer discreto.",
    fullDescription:
      "O Lago Sul Prime reúne sofisticação, praticidade e uma estética contemporânea em uma das regiões mais valorizadas de Brasília. Ideal para viagens de negócios ou descanso urbano, conta com suítes amplas, áreas sociais elegantes e uma operação pensada para quem valoriza privacidade, eficiência e bom atendimento.",
    city: "Brasília",
    state: "DF",
    address: "SHIS QI 12, Conjunto 3 - Lago Sul, Brasília - DF",
    image:
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80",
    alt: "Vista de hotel sofisticado com lounge e iluminação suave",
    gallery: [
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1400&q=80",
    ],
    amenities: [
      "Piscina com deck",
      "Sala de reuniões",
      "Café da manhã",
      "Transfer executivo",
      "Concierge",
      "Lavanderia",
    ],
    contacts: {
      phone: "(61) 3344-2211",
      email: "reservas@lagosulprime.com.br",
      whatsapp: "(61) 99876-5500",
    },
    policies: [
      {
        title: "Cancelamento",
        description: "Reembolso integral em cancelamentos com até 72 horas de antecedência.",
      },
      { title: "Early check-in", description: "Sujeito à disponibilidade e confirmação prévia." },
      { title: "Consumo", description: "Minibar e serviços extras cobrados no check-out." },
    ],
    checkIn: "14:00",
    checkOut: "12:00",
  },
  {
    slug: "boa-viagem-suites",
    name: "Boa Viagem Suites",
    shortDescription:
      "Hospedagem à beira-mar em Recife, com proposta leve e localização estratégica.",
    fullDescription:
      "O Boa Viagem Suites entrega uma estadia prática e confortável para quem quer aproveitar a orla recifense com facilidade. Próximo à praia, restaurantes e polos de negócios, combina atendimento caloroso, quartos claros e uma rotina de serviços pensada para viagens de lazer ou trabalho.",
    city: "Recife",
    state: "PE",
    address: "Avenida Boa Viagem, 1890 - Boa Viagem, Recife - PE",
    image:
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
    alt: "Hotel urbano com recepção elegante",
    gallery: [
      "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80",
    ],
    amenities: [
      "Vista para o mar",
      "Piscina",
      "Restaurante",
      "Wi-Fi",
      "Espaço kids",
      "Serviço de praia",
    ],
    contacts: {
      phone: "(81) 3321-6789",
      email: "reservas@boaviagemsuites.com.br",
      whatsapp: "(81) 99771-6644",
    },
    policies: [
      { title: "Cancelamento", description: "Cancelamento gratuito até 5 dias antes da chegada." },
      { title: "Café da manhã", description: "Incluso em todas as categorias de hospedagem." },
      { title: "Acesso", description: "Acesso às áreas de lazer permitido até as 22h." },
    ],
    checkIn: "14:00",
    checkOut: "12:00",
  },
  {
    slug: "pelourinho-boutique",
    name: "Pelourinho Boutique",
    shortDescription:
      "Hotel com personalidade histórica em Salvador, perto da cultura e da gastronomia.",
    fullDescription:
      "O Pelourinho Boutique une o charme do centro histórico de Salvador a uma experiência de hospedagem elegante e acolhedora. O projeto valoriza arquitetura, arte local e hospitalidade baiana, criando um ambiente ideal para explorar a cidade com conforto e proximidade dos principais roteiros culturais.",
    city: "Salvador",
    state: "BA",
    address: "Ladeira do Carmo, 57 - Pelourinho, Salvador - BA",
    image:
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
    alt: "Suíte de hotel com varanda e vista aberta",
    gallery: [
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1400&q=80",
    ],
    amenities: [
      "Terraço panorâmico",
      "Café regional",
      "Concierge cultural",
      "Transfers",
      "Wi-Fi",
      "Bar autoral",
    ],
    contacts: {
      phone: "(71) 3012-9088",
      email: "reservas@pelourinhoboutique.com.br",
      whatsapp: "(71) 99630-4411",
    },
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito com até 7 dias de antecedência.",
      },
      { title: "Silêncio", description: "Horário de silêncio nas áreas comuns a partir das 23h." },
      {
        title: "Crianças",
        description: "Hospedagem para crianças mediante consulta de categoria.",
      },
    ],
    checkIn: "15:00",
    checkOut: "12:00",
  },
  {
    slug: "gramado-village",
    name: "Gramado Village",
    shortDescription: "Clima acolhedor de serra com design intimista e foco em descanso.",
    fullDescription:
      "O Gramado Village foi concebido para oferecer uma experiência de serra contemporânea, com ambientes aconchegantes, iluminação quente e serviço atencioso. É a escolha ideal para casais, famílias e viajantes que buscam uma estadia confortável perto dos atrativos mais procurados da cidade.",
    city: "Gramado",
    state: "RS",
    address: "Rua das Hortênsias, 620 - Centro, Gramado - RS",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
    alt: "Pousada charmosa com quarto aconchegante",
    gallery: [
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1400&q=80",
    ],
    amenities: [
      "Lareira",
      "Spa",
      "Café colonial",
      "Bicicletas",
      "Transfer local",
      "Sala de leitura",
    ],
    contacts: {
      phone: "(54) 3295-4433",
      email: "reservas@gramadovillage.com.br",
      whatsapp: "(54) 99740-2288",
    },
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito até 10 dias antes da hospedagem.",
      },
      {
        title: "Natal e inverno",
        description: "Datas sazonais têm condições específicas informadas na reserva.",
      },
      { title: "Pets", description: "Pet friendly em unidades selecionadas." },
    ],
    checkIn: "15:00",
    checkOut: "11:00",
  },
  {
    slug: "beira-mar-residence",
    name: "Beira-Mar Residence",
    shortDescription:
      "Hotel de frente para o mar em Florianópolis, com proposta leve e sofisticada.",
    fullDescription:
      "O Beira-Mar Residence oferece uma estadia elegante e relaxante com vista privilegiada para a orla de Florianópolis. Sua proposta combina conforto contemporâneo, áreas externas convidativas e serviços voltados para quem deseja aproveitar a cidade com praticidade, seja a passeio ou em viagem corporativa.",
    city: "Florianópolis",
    state: "SC",
    address: "Avenida da Orla, 510 - Beira-Mar Norte, Florianópolis - SC",
    image:
      "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80",
    alt: "Hotel à beira-mar com área externa iluminada",
    gallery: [
      "https://images.unsplash.com/photo-1455587734955-081b22074882?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1400&q=80",
      "https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=1400&q=80",
    ],
    amenities: ["Rooftop", "Piscina", "Academia", "Café da manhã", "Wi-Fi", "Bicicletário"],
    contacts: {
      phone: "(48) 3211-8822",
      email: "reservas@beiramarresidence.com.br",
      whatsapp: "(48) 99651-7744",
    },
    policies: [
      {
        title: "Cancelamento",
        description: "Cancelamento gratuito até 72 horas antes do check-in.",
      },
      {
        title: "Garagem",
        description: "Vagas limitadas conforme disponibilidade no dia da chegada.",
      },
      {
        title: "Lazer",
        description: "Piscina e rooftop sujeitos a fechamento em caso de manutenção preventiva.",
      },
    ],
    checkIn: "14:00",
    checkOut: "12:00",
  },
];

export function getHotelBySlug(slug: string) {
  return hotels.find((hotel) => hotel.slug === slug);
}
