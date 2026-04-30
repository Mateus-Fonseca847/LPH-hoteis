export type ExperienceKey = "esporte" | "musica" | "cinema";

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
};
