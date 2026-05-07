export type ExperienceKey =
  | "esporte"
  | "musica"
  | "cinema"
  | "descanso"
  | "gastronomia"
  | "natureza"
  | "familia"
  | "negocios";

export type ExperienceDestination = {
  title: string;
  description: string;
  image: string;
  alt: string;
};

export const experienceDestinations: Record<ExperienceKey, ExperienceDestination[]> = {
  esporte: [
    {
      title: "Trilha na Serra dos Órgãos",
      description: "Petrópolis, Teresópolis e montanhas para quem busca aventura ao ar livre.",
      image:
        "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
      alt: "Montanhas e trilha ao ar livre na Serra dos Órgãos",
    },
    {
      title: "Surf em Saquarema",
      description: "Praias, ondas fortes e hospedagens próximas ao circuito do surfe.",
      image:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      alt: "Praia com mar aberto e clima de surf em Saquarema",
    },
    {
      title: "Kitesurf em Jericoacoara",
      description: "Ventos constantes, lagoas e experiências esportivas no litoral cearense.",
      image:
        "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80",
      alt: "Litoral ensolarado e mar aberto para kitesurf em Jericoacoara",
    },
  ],
  musica: [
    {
      title: "Noites de Bossa no Rio",
      description: "Hospede-se perto de bares, casas de shows e experiências musicais cariocas.",
      image:
        "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1200&q=80",
      alt: "Vista noturna urbana com clima musical no Rio de Janeiro",
    },
    {
      title: "Forró em Recife",
      description: "Cultura nordestina, dança e hospedagens próximas aos polos culturais.",
      image:
        "https://images.unsplash.com/photo-1519671482749-fd09be7ccebf?auto=format&fit=crop&w=1200&q=80",
      alt: "Ambiente cultural e festivo para experiências musicais em Recife",
    },
    {
      title: "Jazz e charme em Paraty",
      description: "Eventos intimistas, centro histórico e estadias com clima artístico.",
      image:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
      alt: "Rua charmosa de cidade histórica com atmosfera artística em Paraty",
    },
  ],
  cinema: [
    {
      title: "Festival de Cinema de Gramado",
      description: "Hospedagens próximas ao centro e ao clima cultural da Serra Gaúcha.",
      image:
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      alt: "Destino charmoso de serra com clima cultural em Gramado",
    },
    {
      title: "Mostras culturais em São Paulo",
      description: "Fique perto de cinemas, teatros e centros culturais da cidade.",
      image:
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
      alt: "Cenário urbano e cultural de São Paulo",
    },
    {
      title: "Cine ao ar livre em Brasília",
      description: "Arquitetura, cultura e experiências urbanas para viajantes curiosos.",
      image:
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
      alt: "Arquitetura moderna e experiência cultural urbana em Brasília",
    },
  ],
  descanso: [
    {
      title: "Refúgio em Gramado",
      description: "Serra Gaúcha, clima tranquilo e hospedagens para desacelerar com conforto.",
      image:
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      alt: "Hospedagem aconchegante em destino serrano no Brasil",
    },
    {
      title: "Pousadas em Tiradentes",
      description: "Ruas históricas, silêncio e estadias charmosas para uma pausa sem pressa.",
      image:
        "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
      alt: "Cidade histórica com arquitetura colonial para viagem de descanso",
    },
    {
      title: "Lago Sul em Brasília",
      description: "Hospedagens serenas, vista aberta e rotina mais leve na capital federal.",
      image:
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
      alt: "Hotel elegante com atmosfera tranquila no Brasil",
    },
  ],
  gastronomia: [
    {
      title: "Sabores de Belo Horizonte",
      description: "Bares, mercados e hospedagens próximas a roteiros gastronômicos mineiros.",
      image:
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
      alt: "Restaurante acolhedor para roteiro gastronômico no Brasil",
    },
    {
      title: "Restaurantes em São Paulo",
      description: "Fique perto de bistrôs, cozinhas autorais e experiências urbanas completas.",
      image:
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
      alt: "Ambiente de restaurante contemporâneo em cidade brasileira",
    },
    {
      title: "Culinária em Salvador",
      description: "Cultura baiana, centro histórico e estadias próximas a sabores marcantes.",
      image:
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
      alt: "Mesa com pratos coloridos para experiência gastronômica",
    },
  ],
  natureza: [
    {
      title: "Chapada dos Veadeiros",
      description: "Cachoeiras, trilhas e hospedagens para explorar a natureza de Goiás.",
      image:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
      alt: "Paisagem natural com vegetação e céu aberto no Brasil",
    },
    {
      title: "Amazônia em Manaus",
      description: "Vivências de floresta, rios e estadias conectadas à paisagem amazônica.",
      image:
        "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=80",
      alt: "Floresta tropical e rio para experiência de natureza",
    },
    {
      title: "Praias de Garopaba",
      description: "Mar, dunas e hospedagens próximas a cenários naturais de Santa Catarina.",
      image:
        "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
      alt: "Praia brasileira com mar e faixa de areia para viagem de natureza",
    },
  ],
  familia: [
    {
      title: "Família em Olímpia",
      description: "Parques aquáticos, hotéis confortáveis e programação prática com crianças.",
      image:
        "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?auto=format&fit=crop&w=1200&q=80",
      alt: "Área de lazer familiar com piscina",
    },
    {
      title: "Gramado com crianças",
      description: "Atrações temáticas, clima seguro e hospedagens para famílias na serra.",
      image:
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
      alt: "Hotel em destino serrano para viagem em família",
    },
    {
      title: "Praia do Forte",
      description: "Praia, natureza e estrutura para uma viagem leve com toda a família.",
      image:
        "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80",
      alt: "Litoral brasileiro para viagem em família",
    },
  ],
  negocios: [
    {
      title: "São Paulo executivo",
      description: "Hospede-se perto de centros empresariais, eventos e bons restaurantes.",
      image:
        "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
      alt: "Quarto de hotel contemporâneo para viagem de negócios",
    },
    {
      title: "Brasília objetiva",
      description: "Localização estratégica, mobilidade e hospedagens eficientes na capital.",
      image:
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
      alt: "Ambiente urbano para viagem de negócios no Brasil",
    },
    {
      title: "Eventos em Recife",
      description: "Hotéis próximos a polos comerciais, aeroporto e centros de convenções.",
      image:
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
      alt: "Fachada de hotel urbano para eventos e negócios",
    },
  ],
};
