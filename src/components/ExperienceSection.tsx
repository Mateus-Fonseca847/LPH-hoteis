"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { experienceDestinations, type ExperienceKey } from "@/data/experience-destinations";

type QuestionnaireStepId = "experience-type" | "travel-company" | "budget" | "preferences";
type BudgetKey = "economico" | "intermediario" | "confortavel" | "premium" | "a-definir";
type PreferenceKey =
  | "praia"
  | "serra"
  | "piscina"
  | "cafe-da-manha"
  | "pet-friendly"
  | "criancas"
  | "wi-fi"
  | "estacionamento"
  | "restaurante"
  | "vista-bonita"
  | "localizacao-central"
  | "tranquilidade";
type VisualSuggestionKey = ExperienceKey | BudgetKey | PreferenceKey;

type QuestionnaireAnswers = {
  "experience-type": string | null;
  "travel-company": string | null;
  budget: string | null;
  preferences: PreferenceKey[];
};

type QuestionnaireOption = {
  key: string;
  label: string;
  experienceKey?: ExperienceKey;
};

type QuestionnaireStep = {
  id: QuestionnaireStepId;
  label: string;
  options: QuestionnaireOption[];
};

type Recommendation = {
  key: string;
  title: string;
  location: string;
  reason: string;
  image: string;
  alt: string;
  query: string;
};

const experienceOptions: Array<QuestionnaireOption & { experienceKey: ExperienceKey }> = [
  { key: "esporte", label: "Esporte" },
  { key: "musica", label: "Música" },
  { key: "cinema", label: "Cinema" },
  { key: "descanso", label: "Descanso" },
  { key: "gastronomia", label: "Gastronomia" },
  { key: "natureza", label: "Natureza" },
  { key: "familia", label: "Família" },
  { key: "negocios", label: "Negócios" },
].map((option) => ({
  ...option,
  experienceKey: option.key as ExperienceKey,
}));

const questionnaireSteps: QuestionnaireStep[] = [
  {
    id: "experience-type",
    label: "Que tipo de experiência você procura?",
    options: experienceOptions,
  },
  {
    id: "travel-company",
    label: "Com quem você vai viajar?",
    options: [
      { key: "sozinho", label: "Sozinho" },
      { key: "casal", label: "Casal" },
      { key: "familia", label: "Família" },
      { key: "amigos", label: "Amigos" },
      { key: "trabalho", label: "Trabalho" },
    ],
  },
  {
    id: "budget",
    label: "Qual faixa de orçamento combina com sua viagem?",
    options: [
      { key: "economico", label: "Econômico" },
      { key: "intermediario", label: "Intermediário" },
      { key: "confortavel", label: "Confortável" },
      { key: "premium", label: "Premium" },
      { key: "a-definir", label: "A definir" },
    ],
  },
  {
    id: "preferences",
    label: "O que não pode faltar na sua estadia?",
    options: [
      { key: "praia", label: "Praia" },
      { key: "serra", label: "Serra" },
      { key: "piscina", label: "Piscina" },
      { key: "cafe-da-manha", label: "Café da manhã" },
      { key: "pet-friendly", label: "Pet friendly" },
      { key: "criancas", label: "Espaço para crianças" },
      { key: "wi-fi", label: "Wi-Fi" },
      { key: "estacionamento", label: "Estacionamento" },
      { key: "restaurante", label: "Restaurante" },
      { key: "vista-bonita", label: "Vista bonita" },
      { key: "localizacao-central", label: "Localização central" },
      { key: "tranquilidade", label: "Tranquilidade" },
    ],
  },
];

const travelCompanyVisuals: Record<string, ExperienceKey> = {
  sozinho: "natureza",
  casal: "descanso",
  familia: "familia",
  amigos: "musica",
  trabalho: "negocios",
};

const fallbackRecommendation: Recommendation = {
  key: "fallback-rio",
  title: "Rio com localização prática",
  location: "Rio de Janeiro, RJ",
  reason: "Boa base para comparar estilos de estadia, lazer e deslocamento.",
  image:
    "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1200&q=80",
  alt: "Vista urbana do Rio de Janeiro",
  query: "Rio de Janeiro RJ",
};

const experienceRecommendations: Record<ExperienceKey, Recommendation> = {
  esporte: {
    key: "esporte-serra",
    title: "Serra dos Órgãos ativa",
    location: "Teresópolis, RJ",
    reason: "Combina hospedagem confortável com trilhas, montanhas e natureza por perto.",
    image:
      "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
    alt: "Montanhas na Serra dos Órgãos",
    query: "Teresópolis RJ",
  },
  musica: {
    key: "musica-rio",
    title: "Noites culturais no Rio",
    location: "Rio de Janeiro, RJ",
    reason: "Boa escolha para ficar perto de bares, shows e programação noturna.",
    image:
      "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1200&q=80",
    alt: "Vista noturna urbana no Rio de Janeiro",
    query: "Rio de Janeiro RJ",
  },
  cinema: {
    key: "cinema-gramado",
    title: "Gramado cultural",
    location: "Gramado, RS",
    reason: "Une clima de serra, boa hotelaria e experiências culturais no centro.",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    alt: "Hospedagem aconchegante em Gramado",
    query: "Gramado RS",
  },
  descanso: {
    key: "descanso-tiradentes",
    title: "Pausa em Tiradentes",
    location: "Tiradentes, MG",
    reason: "Ritmo tranquilo, charme histórico e estadias acolhedoras.",
    image:
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
    alt: "Rua histórica em Tiradentes",
    query: "Tiradentes MG",
  },
  gastronomia: {
    key: "gastronomia-bh",
    title: "Sabores de Belo Horizonte",
    location: "Belo Horizonte, MG",
    reason: "Ideal para quem quer colocar restaurantes, bares e mercados no roteiro.",
    image:
      "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
    alt: "Restaurante acolhedor em Belo Horizonte",
    query: "Belo Horizonte MG",
  },
  natureza: {
    key: "natureza-chapada",
    title: "Natureza na Chapada",
    location: "Alto Paraíso, GO",
    reason: "Cachoeiras, trilhas e hospedagens para desacelerar ao ar livre.",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    alt: "Paisagem natural na Chapada",
    query: "Alto Paraíso GO",
  },
  familia: {
    key: "familia-olimpia",
    title: "Família em Olímpia",
    location: "Olímpia, SP",
    reason: "Estrutura de lazer e hospedagens práticas para viajar com crianças.",
    image:
      "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?auto=format&fit=crop&w=1200&q=80",
    alt: "Área de lazer familiar com piscina",
    query: "Olímpia SP",
  },
  negocios: {
    key: "negocios-sp",
    title: "São Paulo objetiva",
    location: "São Paulo, SP",
    reason: "Localização estratégica, mobilidade e serviços úteis para agenda cheia.",
    image:
      "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
    alt: "Quarto contemporâneo para viagem de negócios",
    query: "São Paulo SP",
  },
};

const preferenceRecommendations: Record<PreferenceKey, Recommendation> = {
  praia: {
    key: "pref-praia",
    title: "Praia do Forte leve",
    location: "Mata de São João, BA",
    reason: "Praia, natureza e hotéis com acesso simples ao litoral.",
    image:
      "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80",
    alt: "Praia com mar aberto na Bahia",
    query: "Praia do Forte BA",
  },
  serra: {
    key: "pref-serra",
    title: "Gramado na serra",
    location: "Gramado, RS",
    reason: "Clima ameno, boa hotelaria e ritmo perfeito para descansar.",
    image:
      "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    alt: "Quarto aconchegante em destino de serra",
    query: "Gramado RS",
  },
  piscina: {
    key: "pref-piscina",
    title: "Lazer em Olímpia",
    location: "Olímpia, SP",
    reason: "Boa combinação de piscina, descanso e estrutura para passar o dia.",
    image:
      "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?auto=format&fit=crop&w=1200&q=80",
    alt: "Piscina em hotel para lazer",
    query: "Olímpia SP",
  },
  "cafe-da-manha": {
    key: "pref-cafe",
    title: "Rotina prática em BH",
    location: "Belo Horizonte, MG",
    reason: "Café da manhã, gastronomia e deslocamentos simples para explorar a cidade.",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
    alt: "Mesa de café da manhã",
    query: "Belo Horizonte MG",
  },
  "pet-friendly": {
    key: "pref-pet",
    title: "Pet friendly em Paraty",
    location: "Paraty, RJ",
    reason: "Ritmo tranquilo, áreas abertas e hospedagens mais flexíveis.",
    image:
      "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
    alt: "Paisagem aberta em Paraty",
    query: "Paraty RJ",
  },
  criancas: {
    key: "pref-criancas",
    title: "Família em Gramado",
    location: "Gramado, RS",
    reason: "Atrações, segurança e estrutura para uma viagem mais fácil com crianças.",
    image:
      "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
    alt: "Quarto de hotel para família",
    query: "Gramado RS",
  },
  "wi-fi": {
    key: "pref-wifi",
    title: "Conectado em São Paulo",
    location: "São Paulo, SP",
    reason: "Boa base para trabalhar, circular e manter a viagem organizada.",
    image:
      "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
    alt: "Apartamento urbano com estrutura prática",
    query: "São Paulo SP",
  },
  estacionamento: {
    key: "pref-estacionamento",
    title: "Base prática em Brasília",
    location: "Brasília, DF",
    reason: "Mais flexibilidade para circular de carro e organizar o roteiro.",
    image:
      "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
    alt: "Arquitetura urbana em Brasília",
    query: "Brasília DF",
  },
  restaurante: {
    key: "pref-restaurante",
    title: "Gastronomia em São Paulo",
    location: "São Paulo, SP",
    reason: "Hotéis próximos a restaurantes e experiências gastronômicas fortes.",
    image:
      "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
    alt: "Restaurante contemporâneo em São Paulo",
    query: "São Paulo SP",
  },
  "vista-bonita": {
    key: "pref-vista",
    title: "Vista em Florianópolis",
    location: "Florianópolis, SC",
    reason: "Cenários naturais e estadias que valorizam a paisagem.",
    image:
      "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
    alt: "Vista de praia em Florianópolis",
    query: "Florianópolis SC",
  },
  "localizacao-central": {
    key: "pref-central",
    title: "Centro bem resolvido",
    location: "Curitiba, PR",
    reason: "Boa localização para caminhar, comer bem e reduzir deslocamentos.",
    image:
      "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1200&q=80",
    alt: "Vista urbana central",
    query: "Curitiba PR",
  },
  tranquilidade: {
    key: "pref-tranquilidade",
    title: "Silêncio em Tiradentes",
    location: "Tiradentes, MG",
    reason: "Charme, calma e hospedagens acolhedoras para desacelerar.",
    image:
      "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
    alt: "Rua tranquila em Tiradentes",
    query: "Tiradentes MG",
  },
};

const budgetVisuals: Record<BudgetKey, VisualSuggestionKey> = {
  economico: "economico",
  intermediario: "intermediario",
  confortavel: "confortavel",
  premium: "premium",
  "a-definir": "a-definir",
};

const budgetSuggestions: Record<BudgetKey, (typeof experienceDestinations)[ExperienceKey]> = {
  economico: [
    {
      title: "Estadias essenciais",
      description: "Hotéis práticos, bem localizados e com boa relação custo-benefício.",
      image:
        "https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=1200&q=80",
      alt: "Quarto de hotel simples e organizado para viagem econômica",
    },
    {
      title: "Perto do que importa",
      description: "Sugestões com acesso fácil para reduzir deslocamentos e custos extras.",
      image:
        "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
      alt: "Rua histórica com hospedagens práticas",
    },
    {
      title: "Conforto sem excesso",
      description: "Opções funcionais para quem prefere investir mais no roteiro.",
      image:
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
      alt: "Fachada de hotel urbano com boa localização",
    },
  ],
  intermediario: [
    {
      title: "Equilíbrio na medida",
      description: "Hotéis com conforto, boa estrutura e preço equilibrado para a viagem.",
      image:
        "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
      alt: "Quarto de hotel aconchegante com decoração acolhedora",
    },
    {
      title: "Localização conveniente",
      description: "Sugestões para ficar perto de restaurantes, atrações e serviços.",
      image:
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
      alt: "Apartamento urbano confortável para viagem intermediária",
    },
    {
      title: "Serviços que ajudam",
      description: "Café, recepção eficiente e estrutura para uma estadia sem atrito.",
      image:
        "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
      alt: "Ambiente de restaurante de hotel para viagem equilibrada",
    },
  ],
  confortavel: [
    {
      title: "Mais espaço para relaxar",
      description: "Quartos amplos, áreas de lazer e experiências mais completas.",
      image:
        "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
      alt: "Quarto de hotel amplo e confortável",
    },
    {
      title: "Ritmo leve",
      description: "Hospedagens pensadas para descansar bem entre um passeio e outro.",
      image:
        "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?auto=format&fit=crop&w=1200&q=80",
      alt: "Área de piscina em hotel confortável",
    },
    {
      title: "Detalhes que importam",
      description: "Ambientes acolhedores, boa cama e serviços úteis no dia a dia.",
      image:
        "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
      alt: "Quarto contemporâneo com cama confortável",
    },
  ],
  premium: [
    {
      title: "Experiência premium",
      description: "Hotéis com serviço elevado, design marcante e localizações especiais.",
      image:
        "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
      alt: "Hotel premium com fachada elegante",
    },
    {
      title: "Vista e exclusividade",
      description: "Sugestões com atmosfera sofisticada para uma viagem memorável.",
      image:
        "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
      alt: "Destino sofisticado com paisagem natural",
    },
    {
      title: "Serviço completo",
      description: "Conveniência, gastronomia e conforto para quem quer elevar a estadia.",
      image:
        "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
      alt: "Restaurante elegante para experiência premium",
    },
  ],
  "a-definir": [
    {
      title: "Vamos calibrar juntos",
      description: "Sugestões flexíveis para comparar economia, conforto e localização.",
      image:
        "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
      alt: "Hotel com atmosfera neutra para comparar opções",
    },
    {
      title: "Boas alternativas",
      description: "Opções variadas para decidir o investimento ideal depois.",
      image:
        "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1200&q=80",
      alt: "Vista urbana para viagem com orçamento a definir",
    },
    {
      title: "Escolha sem pressa",
      description: "Compare estilos de hospedagem antes de fechar a faixa de orçamento.",
      image:
        "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
      alt: "Mesa de experiência gastronômica para viagem flexível",
    },
  ],
};

const preferenceSuggestions: Record<PreferenceKey, (typeof experienceDestinations)[ExperienceKey]> =
  {
    praia: [
      {
        title: "Praia por perto",
        description: "Hospedagens com acesso fácil ao mar para entrar no clima da viagem rápido.",
        image:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        alt: "Praia ensolarada próxima à hospedagem",
      },
      {
        title: "Roteiro leve no litoral",
        description: "Sugestões para caminhar, descansar e aproveitar a orla sem complicação.",
        image:
          "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80",
        alt: "Litoral com mar aberto para viagem de praia",
      },
      {
        title: "Estadia com clima de férias",
        description: "Opções para quem quer sol, areia e deslocamentos curtos.",
        image:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        alt: "Destino natural com clima de férias",
      },
    ],
    serra: [
      {
        title: "Refúgio na serra",
        description: "Hotéis aconchegantes, clima ameno e paisagens para desacelerar.",
        image:
          "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
        alt: "Montanhas e paisagem de serra",
      },
      {
        title: "Fim de tarde tranquilo",
        description: "Sugestões com vista, conforto e ritmo mais reservado.",
        image:
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        alt: "Quarto acolhedor em destino serrano",
      },
      {
        title: "Natureza no roteiro",
        description: "Hospedagens próximas a trilhas, mirantes e experiências ao ar livre.",
        image:
          "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
        alt: "Cidade charmosa em região de serra",
      },
    ],
    piscina: [
      {
        title: "Piscina para relaxar",
        description: "Hotéis com área de lazer para aproveitar a estadia também dentro do hotel.",
        image:
          "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?auto=format&fit=crop&w=1200&q=80",
        alt: "Área de piscina em hotel",
      },
      {
        title: "Dias mais leves",
        description: "Sugestões com estrutura para descansar entre passeios.",
        image:
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
        alt: "Hotel confortável com clima de lazer",
      },
      {
        title: "Conforto no intervalo",
        description: "Opções para famílias, casais e viagens em ritmo tranquilo.",
        image:
          "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
        alt: "Quarto confortável para descansar",
      },
    ],
    "cafe-da-manha": [
      {
        title: "Começo de dia completo",
        description: "Hospedagens com café da manhã para sair pronto para o roteiro.",
        image:
          "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
        alt: "Mesa de café da manhã com alimentos variados",
      },
      {
        title: "Rotina mais prática",
        description: "Sugestões que reduzem decisões logo cedo e deixam a viagem mais fluida.",
        image:
          "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
        alt: "Ambiente de restaurante acolhedor",
      },
      {
        title: "Conveniência diária",
        description: "Opções para quem valoriza conforto desde a primeira refeição.",
        image:
          "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
        alt: "Restaurante de hotel para café da manhã",
      },
    ],
    "pet-friendly": [
      {
        title: "Pet bem-vindo",
        description: "Opções pensadas para viajar com seu pet com mais conforto.",
        image:
          "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=80",
        alt: "Área verde para viagem pet friendly",
      },
      {
        title: "Espaços abertos",
        description: "Sugestões com áreas externas e rotina mais tranquila.",
        image:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        alt: "Paisagem natural com espaço aberto",
      },
      {
        title: "Estadia sem aperto",
        description: "Hospedagens com praticidade para todos viajarem melhor.",
        image:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        alt: "Praia ampla para viagem tranquila",
      },
    ],
    criancas: [
      {
        title: "Estrutura para crianças",
        description: "Hotéis com lazer, segurança e praticidade para a família.",
        image:
          "https://images.unsplash.com/photo-1563911302283-d2bc129e7570?auto=format&fit=crop&w=1200&q=80",
        alt: "Área de lazer familiar com piscina",
      },
      {
        title: "Mais fácil para todos",
        description: "Sugestões com quartos confortáveis e atividades por perto.",
        image:
          "https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=1200&q=80",
        alt: "Quarto de hotel para viagem em família",
      },
      {
        title: "Roteiro sem correria",
        description: "Opções para manter a viagem leve com crianças.",
        image:
          "https://images.unsplash.com/photo-1500375592092-40eb2168fd21?auto=format&fit=crop&w=1200&q=80",
        alt: "Destino de praia para viagem em família",
      },
    ],
    "wi-fi": [
      {
        title: "Conexão confiável",
        description: "Hospedagens práticas para trabalhar, planejar passeios e ficar online.",
        image:
          "https://images.unsplash.com/photo-1522798514-97ceb8c4f1c8?auto=format&fit=crop&w=1200&q=80",
        alt: "Quarto de hotel contemporâneo para trabalhar online",
      },
      {
        title: "Viagem conectada",
        description: "Sugestões úteis para quem precisa de internet no dia a dia.",
        image:
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        alt: "Apartamento urbano com estrutura prática",
      },
      {
        title: "Rotina sem pausa",
        description: "Opções para combinar descanso, trabalho e planejamento.",
        image:
          "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
        alt: "Hotel urbano com estrutura para viagem conectada",
      },
    ],
    estacionamento: [
      {
        title: "Chegada mais simples",
        description: "Hotéis com estacionamento para facilitar viagens de carro.",
        image:
          "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?auto=format&fit=crop&w=1200&q=80",
        alt: "Hotel urbano com acesso prático",
      },
      {
        title: "Mobilidade no roteiro",
        description: "Sugestões para circular com flexibilidade e menos preocupação.",
        image:
          "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
        alt: "Destino urbano com mobilidade prática",
      },
      {
        title: "Praticidade todos os dias",
        description: "Opções bem resolvidas para entrar, sair e explorar no seu ritmo.",
        image:
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        alt: "Cidade com hospedagem prática para deslocamento",
      },
    ],
    restaurante: [
      {
        title: "Restaurante no hotel",
        description: "Sugestões para jantar bem sem depender de deslocamento.",
        image:
          "https://images.unsplash.com/photo-1552566626-52f8b828add9?auto=format&fit=crop&w=1200&q=80",
        alt: "Restaurante contemporâneo em hotel",
      },
      {
        title: "Boa mesa por perto",
        description: "Opções próximas a bares, bistrôs e experiências gastronômicas.",
        image:
          "https://images.unsplash.com/photo-1514933651103-005eec06c04b?auto=format&fit=crop&w=1200&q=80",
        alt: "Restaurante acolhedor para roteiro gastronômico",
      },
      {
        title: "Viagem com sabor",
        description: "Hospedagens para quem coloca gastronomia no centro do roteiro.",
        image:
          "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=1200&q=80",
        alt: "Mesa com pratos variados",
      },
    ],
    "vista-bonita": [
      {
        title: "Vista para lembrar",
        description: "Hospedagens com cenário especial para valorizar cada pausa.",
        image:
          "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=80",
        alt: "Paisagem bonita vista da hospedagem",
      },
      {
        title: "Acordar melhor",
        description: "Sugestões com janelas, mirantes e ambientes mais inspiradores.",
        image:
          "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1200&q=80",
        alt: "Vista de montanhas",
      },
      {
        title: "Cenário no roteiro",
        description: "Opções onde a própria estadia também faz parte da experiência.",
        image:
          "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1200&q=80",
        alt: "Vista de praia e mar",
      },
    ],
    "localizacao-central": [
      {
        title: "Tudo mais perto",
        description: "Hotéis centrais para reduzir deslocamentos e aproveitar melhor o tempo.",
        image:
          "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        alt: "Hospedagem central em cenário urbano",
      },
      {
        title: "Roteiro a pé",
        description: "Sugestões próximas a atrações, restaurantes e serviços.",
        image:
          "https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?auto=format&fit=crop&w=1200&q=80",
        alt: "Vista urbana noturna próxima a atrações",
      },
      {
        title: "Base estratégica",
        description: "Opções para sair fácil e voltar sem complicar a viagem.",
        image:
          "https://images.unsplash.com/photo-1445019980597-93fa8acb246c?auto=format&fit=crop&w=1200&q=80",
        alt: "Arquitetura urbana em localização central",
      },
    ],
    tranquilidade: [
      {
        title: "Estadia tranquila",
        description: "Hospedagens reservadas para descansar sem pressa.",
        image:
          "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        alt: "Quarto tranquilo em hospedagem aconchegante",
      },
      {
        title: "Ritmo silencioso",
        description: "Sugestões com clima calmo, boa cama e menos movimento.",
        image:
          "https://images.unsplash.com/photo-1518005020951-eccb494ad742?auto=format&fit=crop&w=1200&q=80",
        alt: "Rua histórica tranquila",
      },
      {
        title: "Pausa de verdade",
        description: "Opções para quem quer relaxar mais do que preencher agenda.",
        image:
          "https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?auto=format&fit=crop&w=1200&q=80",
        alt: "Paisagem natural tranquila",
      },
    ],
  };

const getOptionLabel = (stepId: QuestionnaireStepId, key: string | null) => {
  if (!key) return "A definir";

  return (
    questionnaireSteps
      .find((step) => step.id === stepId)
      ?.options.find((option) => option.key === key)?.label ?? "A definir"
  );
};

const getSearchHref = (query: string) => `/buscar?destino=${encodeURIComponent(query)}`;

const getRecommendations = (answers: QuestionnaireAnswers) => {
  const recommendations = answers.preferences.map(
    (preference) => preferenceRecommendations[preference]
  );
  const experienceKey = answers["experience-type"] as ExperienceKey | null;

  if (experienceKey) {
    recommendations.push(experienceRecommendations[experienceKey]);
  }

  recommendations.push(fallbackRecommendation);

  return recommendations
    .filter(
      (recommendation, index, allRecommendations) =>
        allRecommendations.findIndex((item) => item.key === recommendation.key) === index
    )
    .slice(0, 3);
};

export function ExperienceSection() {
  const [displayedCategory, setDisplayedCategory] = useState<VisualSuggestionKey>("esporte");
  const [currentStep, setCurrentStep] = useState(0);
  const [answers, setAnswers] = useState<QuestionnaireAnswers>({
    "experience-type": null,
    "travel-company": null,
    budget: null,
    preferences: [],
  });
  const [confirmedAnswers, setConfirmedAnswers] = useState<QuestionnaireAnswers>({
    "experience-type": null,
    "travel-company": null,
    budget: null,
    preferences: [],
  });
  const [showResult, setShowResult] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const timeoutRef = useRef<number | null>(null);
  const activeStep = questionnaireSteps[currentStep];
  const activeAnswer = answers[activeStep.id];
  const isPreferenceStep = activeStep.id === "preferences";
  const selectedPreferenceLabels = questionnaireSteps[3].options
    .filter((option) => confirmedAnswers.preferences.includes(option.key as PreferenceKey))
    .map((option) => option.label);
  const primaryPreferenceLabels = selectedPreferenceLabels.slice(0, 4);
  const resultRecommendations = getRecommendations(confirmedAnswers);
  const resultSummary = [
    {
      label: "Experiência",
      value: getOptionLabel("experience-type", confirmedAnswers["experience-type"]),
    },
    {
      label: "Companhia",
      value: getOptionLabel("travel-company", confirmedAnswers["travel-company"]),
    },
    { label: "Orçamento", value: getOptionLabel("budget", confirmedAnswers.budget) },
    {
      label: "Preferências",
      value: primaryPreferenceLabels.length > 0 ? primaryPreferenceLabels.join(", ") : "A definir",
    },
  ];
  const canContinue = showResult
    ? false
    : isPreferenceStep
      ? answers.preferences.length > 0
      : Boolean(activeAnswer);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const updateDisplayedCategory = (nextExperience: VisualSuggestionKey) => {
    if (isTransitioning || nextExperience === displayedCategory) return;

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    setIsTransitioning(true);

    timeoutRef.current = window.setTimeout(() => {
      setDisplayedCategory(nextExperience);
      setIsTransitioning(false);
    }, 180);
  };

  const getVisualCategoryForStep = (
    stepIndex: number,
    nextAnswers: QuestionnaireAnswers
  ): VisualSuggestionKey | null => {
    const stepId = questionnaireSteps[stepIndex].id;

    if (stepId === "experience-type") {
      return (nextAnswers["experience-type"] as ExperienceKey | null) ?? displayedCategory;
    }

    if (stepId === "travel-company") {
      const company = nextAnswers["travel-company"];

      return company
        ? travelCompanyVisuals[company]
        : (nextAnswers["experience-type"] as ExperienceKey | null);
    }

    if (stepId === "budget") {
      const budget = nextAnswers.budget as BudgetKey | null;

      return budget
        ? budgetVisuals[budget]
        : nextAnswers["travel-company"]
          ? travelCompanyVisuals[nextAnswers["travel-company"]]
          : (nextAnswers["experience-type"] as ExperienceKey | null);
    }

    const lastPreference = nextAnswers.preferences.at(-1);

    return lastPreference
      ? lastPreference
      : nextAnswers.budget
        ? budgetVisuals[nextAnswers.budget as BudgetKey]
        : nextAnswers["travel-company"]
          ? travelCompanyVisuals[nextAnswers["travel-company"]]
          : (nextAnswers["experience-type"] as ExperienceKey | null);
  };

  const handleOptionSelect = (option: QuestionnaireOption) => {
    setShowResult(false);

    if (activeStep.id === "preferences") {
      const preferenceKey = option.key as PreferenceKey;
      const isSelected = answers.preferences.includes(preferenceKey);
      const nextPreferences = isSelected
        ? answers.preferences.filter((preference) => preference !== preferenceKey)
        : [...answers.preferences, preferenceKey];
      const nextAnswers = {
        ...answers,
        preferences: nextPreferences,
      };

      setAnswers(nextAnswers);

      return;
    }

    const nextAnswers = {
      ...answers,
      [activeStep.id]: option.key,
    };

    setAnswers(nextAnswers);
  };

  const handleContinue = () => {
    if (!canContinue) {
      return;
    }

    const nextConfirmedAnswers = {
      ...confirmedAnswers,
      [activeStep.id]:
        activeStep.id === "preferences" ? [...answers.preferences] : answers[activeStep.id],
    } as QuestionnaireAnswers;
    const nextVisualCategory = getVisualCategoryForStep(currentStep, nextConfirmedAnswers);

    setConfirmedAnswers(nextConfirmedAnswers);

    if (nextVisualCategory) {
      updateDisplayedCategory(nextVisualCategory);
    }

    if (currentStep === questionnaireSteps.length - 1) {
      setShowResult(true);
      return;
    }

    const nextStep = Math.min(questionnaireSteps.length - 1, currentStep + 1);
    setCurrentStep(nextStep);
  };

  const handleBack = () => {
    if (showResult) {
      setShowResult(false);
      return;
    }

    setCurrentStep(Math.max(0, currentStep - 1));
  };

  const handleRestart = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    setAnswers({
      "experience-type": null,
      "travel-company": null,
      budget: null,
      preferences: [],
    });
    setConfirmedAnswers({
      "experience-type": null,
      "travel-company": null,
      budget: null,
      preferences: [],
    });
    setCurrentStep(0);
    setShowResult(false);
    setDisplayedCategory("esporte");
    setIsTransitioning(false);
  };

  const destinations =
    displayedCategory in preferenceSuggestions
      ? preferenceSuggestions[displayedCategory as PreferenceKey]
      : displayedCategory in budgetSuggestions
        ? budgetSuggestions[displayedCategory as BudgetKey]
        : experienceDestinations[displayedCategory as ExperienceKey];

  return (
    <section id="destinations" className="showcase section reveal">
      <div className="showcase-copy">
        <h2>
          {showResult
            ? "Encontramos experiências para o seu perfil"
            : "Experiência sem complicação"}
        </h2>
        <p>
          {showResult
            ? "Suas escolhas ajudam a priorizar destinos, estrutura e localização para uma estadia mais certeira."
            : "Escolha suas preferências e hospede-se perto do que faz você feliz, com uma reserva pensada para conforto do check-in ao check-out."}
        </p>

        <div key={showResult ? "result" : activeStep.id} className="experience-question-panel">
          <div className="experience-stepper" aria-label="Pergunta atual">
            <strong>{showResult ? "Sugestão pronta para sua estadia" : activeStep.label}</strong>
          </div>

          {showResult ? (
            <div className="experience-result">
              <strong>Resumo do perfil</strong>
              <dl className="experience-result-summary">
                {resultSummary.map((item) => (
                  <div key={item.label}>
                    <dt>{item.label}</dt>
                    <dd>{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <div className="category-pills">
              {activeStep.options.map((option) => {
                const isSelected = isPreferenceStep
                  ? answers.preferences.includes(option.key as PreferenceKey)
                  : activeAnswer === option.key;

                return (
                  <button
                    key={option.key}
                    className={`pill experience-filter ${isSelected ? "active" : ""}`}
                    type="button"
                    aria-pressed={isSelected}
                    data-experience={option.key}
                    onClick={() => handleOptionSelect(option)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showResult ? (
        <div
          className={`showcase-gallery experience-recommendations ${isTransitioning ? "is-transitioning" : ""}`}
        >
          {resultRecommendations.map((recommendation, index) => (
            <article
              key={recommendation.key}
              className="experience-recommendation-card reveal experience-card"
              data-card-index={index}
            >
              <div className="experience-recommendation-card__image">
                <Image
                  src={recommendation.image}
                  alt={recommendation.alt}
                  fill
                  sizes="(max-width: 900px) 100vw, 33vw"
                />
              </div>
              <div className="experience-recommendation-card__body">
                <span>{recommendation.location}</span>
                <strong>{recommendation.title}</strong>
                <p>{recommendation.reason}</p>
                <Link
                  className="card-cta-button experience-recommendation-card__link"
                  href={getSearchHref(recommendation.query)}
                >
                  Ver hotéis
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className={`showcase-gallery ${isTransitioning ? "is-transitioning" : ""}`}>
          <article
            className="gallery-card large reveal experience-card experience-card--featured"
            data-card-index="0"
          >
            <Image
              src={destinations[0].image}
              alt={destinations[0].alt}
              fill
              sizes="(max-width: 900px) 100vw, 46vw"
            />
            <div className="gallery-caption">
              <strong>{destinations[0].title}</strong>
              <span>{destinations[0].description}</span>
            </div>
          </article>

          <div className="gallery-side">
            {destinations.slice(1).map((destination, index) => (
              <article
                key={`${displayedCategory}-${destination.title}`}
                className="gallery-card reveal experience-card experience-card--small"
                data-card-index={index + 1}
              >
                <Image
                  src={destination.image}
                  alt={destination.alt}
                  fill
                  sizes="(max-width: 900px) 100vw, 260px"
                />
                <div className="gallery-caption">
                  <strong>{destination.title}</strong>
                  <span>{destination.description}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="experience-step-actions">
        {currentStep > 0 ? (
          <button
            className="outline-round experience-step-button"
            type="button"
            onClick={handleBack}
          >
            Voltar
          </button>
        ) : null}
        {showResult ? null : (
          <button
            className="outline-round experience-step-button"
            type="button"
            disabled={!canContinue}
            onClick={handleContinue}
          >
            Continuar
          </button>
        )}
        {showResult ? (
          <button
            className="outline-round experience-step-button"
            type="button"
            onClick={handleRestart}
          >
            Refazer perfil
          </button>
        ) : null}
      </div>
    </section>
  );
}
