"use client";

import Image from "next/image";
import Link from "next/link";
import { type MouseEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import {
  experienceDestinations,
  type ExperienceDestination,
  type ExperienceKey,
} from "@/data/experience-destinations";
import type { PublishedHotelCard } from "@/lib/hotel-data";
import {
  getProfileExperienceMatches,
  type ProfileExperienceMatch,
  type ProfileTouristAttraction,
} from "@/lib/profile-recommendations";

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
  destinationCity?: string;
  destinationState?: string;
};

type ExperienceVisualImageProps = {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
};

const MODAL_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

type ExperienceSectionProps = {
  hotels: PublishedHotelCard[];
};

type ExperienceRecommendationMatch = ProfileExperienceMatch<Recommendation>;

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

const experienceDestinationMetadata: Record<
  string,
  {
    city: string;
    state: string;
  }
> = {
  "Trilha na Serra dos Órgãos": { city: "Teresópolis", state: "RJ" },
  "Surf em Saquarema": { city: "Saquarema", state: "RJ" },
  "Kitesurf em Jericoacoara": { city: "Jijoca de Jericoacoara", state: "CE" },
  "Noites de Bossa no Rio": { city: "Rio de Janeiro", state: "RJ" },
  "Forró em Recife": { city: "Recife", state: "PE" },
  "Jazz e charme em Paraty": { city: "Paraty", state: "RJ" },
  "Festival de Cinema de Gramado": { city: "Gramado", state: "RS" },
  "Mostras culturais em São Paulo": { city: "São Paulo", state: "SP" },
  "Cine ao ar livre em Brasília": { city: "Brasília", state: "DF" },
  "Refúgio em Gramado": { city: "Gramado", state: "RS" },
  "Pousadas em Tiradentes": { city: "Tiradentes", state: "MG" },
  "Lago Sul em Brasília": { city: "Brasília", state: "DF" },
  "Sabores de Belo Horizonte": { city: "Belo Horizonte", state: "MG" },
  "Restaurantes em São Paulo": { city: "São Paulo", state: "SP" },
  "Culinária em Salvador": { city: "Salvador", state: "BA" },
  "Chapada dos Veadeiros": { city: "Alto Paraíso de Goiás", state: "GO" },
  "Amazônia em Manaus": { city: "Manaus", state: "AM" },
  "Praias de Garopaba": { city: "Garopaba", state: "SC" },
  "Família em Olímpia": { city: "Olímpia", state: "SP" },
  "Gramado com crianças": { city: "Gramado", state: "RS" },
  "Praia do Forte": { city: "Mata de São João", state: "BA" },
  "São Paulo executivo": { city: "São Paulo", state: "SP" },
  "Brasília objetiva": { city: "Brasília", state: "DF" },
  "Eventos em Recife": { city: "Recife", state: "PE" },
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

const getDestinationsForCategory = (category: VisualSuggestionKey) =>
  category in preferenceSuggestions
    ? preferenceSuggestions[category as PreferenceKey]
    : category in budgetSuggestions
      ? budgetSuggestions[category as BudgetKey]
      : experienceDestinations[category as ExperienceKey];

const getDestinationRecommendation = (
  destination: ExperienceDestination,
  key: string
): Recommendation | null => {
  const metadata = experienceDestinationMetadata[destination.title];

  if (!metadata) {
    return null;
  }

  return {
    key,
    title: destination.title,
    location: `${metadata.city}, ${metadata.state}`,
    reason: destination.description,
    image: destination.image,
    alt: destination.alt,
    query: `${metadata.city} ${metadata.state}`,
    destinationCity: metadata.city,
    destinationState: metadata.state,
  };
};

const getExperienceDestinationRecommendations = (experienceKey: ExperienceKey): Recommendation[] =>
  experienceDestinations[experienceKey].reduce<Recommendation[]>(
    (recommendations, destination, index) => {
      const recommendation = getDestinationRecommendation(
        destination,
        `destination-${experienceKey}-${index}`
      );

      if (!recommendation) {
        return recommendations;
      }

      recommendations.push(recommendation);

      return recommendations;
    },
    []
  );

const preloadImages = async (sources: string[]) => {
  await Promise.allSettled(
    sources.map(
      (source) =>
        new Promise<void>((resolve) => {
          const image = new window.Image();
          image.onload = () => resolve();
          image.onerror = () => resolve();
          image.src = source;

          if (image.decode) {
            image.decode().then(resolve).catch(resolve);
          }
        })
    )
  );
};

function ExperienceVisualImage({ src, alt, sizes, priority = false }: ExperienceVisualImageProps) {
  const [imageState, setImageState] = useState<{
    src: string;
    status: "loaded" | "error";
  } | null>(null);
  const currentImageState = imageState?.src === src ? imageState.status : "loading";

  return (
    <>
      <div className="experience-image-fallback" aria-hidden="true">
        <span>{currentImageState === "error" ? "Imagem indisponível" : "Carregando imagem"}</span>
      </div>
      <Image
        className={`experience-image ${currentImageState === "loaded" ? "is-loaded" : ""}`}
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoad={() => setImageState({ src, status: "loaded" })}
        onError={() => setImageState({ src, status: "error" })}
      />
    </>
  );
}

function AttractionIcon({ iconType }: { iconType: ProfileTouristAttraction["iconType"] }) {
  if (iconType === "beach") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M3 18.5c2 1.1 4 1.1 6 0s4-1.1 6 0 4 1.1 6 0" />
        <path d="M4 14.5c2 1.1 4 1.1 6 0s4-1.1 6 0 4 1.1 6 0" />
        <path d="M12 3v8" />
        <path d="M7 8c1.5-3 4.7-4.4 8-3.3" />
        <path d="M17 8c-1.5-3-4.7-4.4-8-3.3" />
      </svg>
    );
  }

  if (iconType === "nature") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 21v-8" />
        <path d="M7 13c-2.8-1.8-3.3-5.6-1-8 3.4.3 5.8 2.5 6 6" />
        <path d="M17 13c2.8-1.8 3.3-5.6 1-8-3.4.3-5.8 2.5-6 6" />
      </svg>
    );
  }

  if (iconType === "food") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M7 3v8" />
        <path d="M4.5 3v5.5A2.5 2.5 0 0 0 7 11a2.5 2.5 0 0 0 2.5-2.5V3" />
        <path d="M7 11v10" />
        <path d="M17 3c-2 1.8-3 4.2-3 7v3h5V3" />
        <path d="M17 13v8" />
      </svg>
    );
  }

  if (iconType === "shopping") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M6 8h12l1 13H5L6 8Z" />
        <path d="M9 8a3 3 0 0 1 6 0" />
      </svg>
    );
  }

  if (iconType === "business") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M4 21V7l8-4 8 4v14" />
        <path d="M9 21v-7h6v7" />
        <path d="M8 9h.01" />
        <path d="M12 9h.01" />
        <path d="M16 9h.01" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M12 21s7-5.2 7-11a7 7 0 0 0-14 0c0 5.8 7 11 7 11Z" />
      <path d="M12 10.5h.01" />
      <path d="M9 17h6" />
    </svg>
  );
}

const getRecommendations = (answers: QuestionnaireAnswers) => {
  const recommendations = answers.preferences.map(
    (preference) => preferenceRecommendations[preference]
  );
  const experienceKey = answers["experience-type"] as ExperienceKey | null;

  if (experienceKey) {
    recommendations.unshift(...getExperienceDestinationRecommendations(experienceKey));
  }

  recommendations.push(fallbackRecommendation);

  return recommendations
    .filter(
      (recommendation, index, allRecommendations) =>
        allRecommendations.findIndex((item) => item.key === recommendation.key) === index
    )
    .slice(0, 3);
};

export function ExperienceSection({ hotels }: ExperienceSectionProps) {
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
  const [selectedExperience, setSelectedExperience] =
    useState<ExperienceRecommendationMatch | null>(null);
  const experienceSectionRef = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const transitionTokenRef = useRef(0);
  const modalTitleId = useId();
  const safeCurrentStep = Math.min(Math.max(currentStep, 0), questionnaireSteps.length - 1);
  const activeStep = questionnaireSteps[safeCurrentStep];
  const activeAnswer = answers[activeStep.id];
  const isPreferenceStep = activeStep.id === "preferences";
  const selectedPreferenceLabels = questionnaireSteps[3].options
    .filter((option) => confirmedAnswers.preferences.includes(option.key as PreferenceKey))
    .map((option) => option.label);
  const primaryPreferenceLabels = selectedPreferenceLabels.slice(0, 4);
  const resultRecommendations = getProfileExperienceMatches({
    recommendations: getRecommendations(confirmedAnswers),
    hotels,
  });
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
      value: primaryPreferenceLabels.length > 0 ? primaryPreferenceLabels.join(", ") : null,
    },
  ];
  const canContinue =
    showResult || isTransitioning ? false : isPreferenceStep ? true : Boolean(activeAnswer);

  useEffect(() => {
    preloadImages(
      getDestinationsForCategory(displayedCategory).map((destination) => destination.image)
    );
  }, [displayedCategory]);

  useEffect(() => {
    return () => {
      transitionTokenRef.current += 1;

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showResult) return;

    const scrollFrame = window.requestAnimationFrame(() => {
      experienceSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });

    return () => window.cancelAnimationFrame(scrollFrame);
  }, [showResult]);

  useEffect(() => {
    if (!selectedExperience) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedExperience(null);
        return;
      }

      if (event.key !== "Tab" || !modalRef.current) {
        return;
      }

      const focusableElements = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(MODAL_FOCUSABLE_SELECTOR)
      );

      if (!focusableElements.length) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    window.requestAnimationFrame(() => modalRef.current?.focus());

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
      openerRef.current?.focus();
    };
  }, [selectedExperience]);

  const updateDisplayedCategory = (nextExperience: VisualSuggestionKey) => {
    if (isTransitioning || nextExperience === displayedCategory) return;

    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    const transitionToken = transitionTokenRef.current + 1;
    transitionTokenRef.current = transitionToken;
    setIsTransitioning(true);

    window.setTimeout(() => {
      preloadImages(
        getDestinationsForCategory(nextExperience).map((destination) => destination.image)
      ).then(() => {
        if (transitionTokenRef.current !== transitionToken) {
          return;
        }

        setDisplayedCategory(nextExperience);
        setIsTransitioning(false);
      });
    }, 90);

    timeoutRef.current = window.setTimeout(() => {
      if (transitionTokenRef.current !== transitionToken) {
        return;
      }

      setDisplayedCategory(nextExperience);
      setIsTransitioning(false);
    }, 900);
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
    const isFinalStep = safeCurrentStep === questionnaireSteps.length - 1;

    setConfirmedAnswers(nextConfirmedAnswers);

    if (isFinalStep) {
      const transitionToken = transitionTokenRef.current + 1;
      transitionTokenRef.current = transitionToken;
      setShowResult(true);
      setIsTransitioning(false);

      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      preloadImages(
        getRecommendations(nextConfirmedAnswers).map((recommendation) => recommendation.image)
      ).then(() => {
        if (transitionTokenRef.current !== transitionToken) {
          return;
        }
      });
      return;
    }

    const nextVisualCategory = getVisualCategoryForStep(safeCurrentStep, nextConfirmedAnswers);

    if (nextVisualCategory) {
      updateDisplayedCategory(nextVisualCategory);
    }

    const nextStep = Math.min(questionnaireSteps.length - 1, safeCurrentStep + 1);
    setCurrentStep(nextStep);
  };

  const handleBack = () => {
    if (showResult) {
      setCurrentStep(Math.max(questionnaireSteps.length - 1, 0));
      setShowResult(false);
      window.requestAnimationFrame(() => {
        experienceSectionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      });
      return;
    }

    setCurrentStep(Math.max(0, safeCurrentStep - 1));
  };

  const handleRestart = () => {
    transitionTokenRef.current += 1;

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
    setSelectedExperience(null);
    setDisplayedCategory("esporte");
    setIsTransitioning(false);
    window.requestAnimationFrame(() => {
      experienceSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const handleExperienceOpen = (
    recommendation: ExperienceRecommendationMatch,
    event: MouseEvent<HTMLButtonElement>
  ) => {
    openerRef.current = event.currentTarget;
    setSelectedExperience(recommendation);
  };

  const destinations = getDestinationsForCategory(displayedCategory);
  const getVisualExperienceMatch = (destination: ExperienceDestination, index: number) => {
    const recommendation = getDestinationRecommendation(
      destination,
      `visual-${displayedCategory}-${index}`
    );

    if (!recommendation) {
      return null;
    }

    return (
      getProfileExperienceMatches({
        recommendations: [recommendation],
        hotels,
      }).at(0) ?? null
    );
  };

  const renderVisualCard = (
    destination: ExperienceDestination,
    index: number,
    variant: "featured" | "small"
  ) => {
    const match = getVisualExperienceMatch(destination, index);
    const cardClassName = [
      "gallery-card",
      variant === "featured" ? "large" : "",
      "reveal",
      "experience-card",
      variant === "featured" ? "experience-card--featured" : "experience-card--small",
      match ? "experience-card--interactive" : "",
    ]
      .filter(Boolean)
      .join(" ");
    const imageSizes =
      variant === "featured"
        ? "(max-width: 820px) 100vw, (max-width: 1180px) 58vw, 38vw"
        : "(max-width: 820px) 100vw, (max-width: 1180px) 34vw, 24vw";
    const content = (
      <>
        <ExperienceVisualImage
          src={destination.image}
          alt={destination.alt}
          sizes={imageSizes}
          priority={variant === "featured"}
        />
        <div className="gallery-caption">
          <strong>{destination.title}</strong>
          <span>{destination.description}</span>
        </div>
      </>
    );

    if (match) {
      return (
        <button
          key={`experience-visual-card-${index}`}
          type="button"
          className={cardClassName}
          data-card-index={index}
          aria-label={`Ver hotéis próximos para ${destination.title}`}
          onClick={(event) => handleExperienceOpen(match, event)}
        >
          {content}
        </button>
      );
    }

    return (
      <article
        key={`experience-visual-card-${index}`}
        className={cardClassName}
        data-card-index={index}
      >
        {content}
      </article>
    );
  };
  const experienceHotelsModal = selectedExperience
    ? createPortal(
        <div
          className="experience-hotels-modal"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setSelectedExperience(null);
            }
          }}
        >
          <div
            ref={modalRef}
            className="experience-hotels-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={modalTitleId}
            tabIndex={-1}
          >
            <div className="experience-hotels-dialog__header">
              <div>
                <span>
                  {selectedExperience.destinationCity}, {selectedExperience.destinationState}
                </span>
                <h3 id={modalTitleId}>{selectedExperience.experience.title}</h3>
                <p>{selectedExperience.experience.reason}</p>
              </div>
              <button
                className="experience-hotels-dialog__close"
                type="button"
                aria-label="Fechar hotéis próximos"
                onClick={() => setSelectedExperience(null)}
              >
                ×
              </button>
            </div>

            {selectedExperience.hotels.length > 0 ? (
              <div className="experience-hotels-list">
                {selectedExperience.hotels.map(({ hotel, proximityLabel }) => (
                  <article className="experience-hotel-option" key={hotel.slug}>
                    <div className="experience-hotel-option__media">
                      {hotel.coverImageUrl ? (
                        <Image
                          src={hotel.coverImageUrl}
                          alt={hotel.name}
                          fill
                          sizes="(max-width: 720px) 92vw, 220px"
                        />
                      ) : (
                        <span>{hotel.name}</span>
                      )}
                    </div>
                    <div className="experience-hotel-option__body">
                      <span>{proximityLabel}</span>
                      <strong>{hotel.name}</strong>
                      <p>
                        {hotel.shortDescription ||
                          `${hotel.city}, ${hotel.state} · hospedagem compatível com este destino.`}
                      </p>
                      <Link
                        className="card-cta-button experience-hotel-option__link"
                        href={`/hoteis/${hotel.slug}`}
                      >
                        Ver hotel
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="experience-hotels-empty" role="status">
                <strong>Ainda não temos hotéis publicados próximos a este destino.</strong>
                <p>
                  Você pode explorar outras opções disponíveis enquanto ampliamos nossa curadoria.
                </p>
                <Link className="outline-round" href="/buscar">
                  Explorar hotéis
                </Link>
              </div>
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  if (showResult) {
    return (
      <section
        ref={experienceSectionRef}
        id="destinations"
        className="showcase showcase--result section is-visible"
      >
        <div className="experience-result-hero">
          <span className="experience-result-kicker">Resultado do perfil</span>
          <h2>Experiências para o seu perfil</h2>
          <p>Selecionamos opções alinhadas às preferências que você escolheu.</p>
          <div className="experience-result-chips" aria-label="Resumo do perfil">
            {resultSummary
              .filter((item) => item.value)
              .map((item) => (
                <span key={item.label}>{item.value}</span>
              ))}
          </div>
        </div>

        {resultRecommendations.length > 0 ? (
          <div className="showcase-gallery experience-recommendations">
            {resultRecommendations.map((recommendation, index) => (
              <button
                key={recommendation.experience.key}
                type="button"
                className="experience-recommendation-card experience-card"
                data-card-index={index}
                onClick={(event) => handleExperienceOpen(recommendation, event)}
                aria-label={`Ver hotéis próximos para ${recommendation.experience.title}`}
              >
                <div className="experience-recommendation-card__image">
                  <ExperienceVisualImage
                    src={recommendation.image}
                    alt={
                      recommendation.hotel
                        ? `${recommendation.hotel.name} em ${recommendation.hotel.city}`
                        : recommendation.experience.alt
                    }
                    sizes="(max-width: 720px) 100vw, (max-width: 1180px) 50vw, 33vw"
                  />
                </div>
                <div className="experience-recommendation-card__body">
                  <span className="experience-recommendation-card__eyebrow">
                    {recommendation.destinationCity}, {recommendation.destinationState}
                  </span>
                  <strong>{recommendation.experience.title}</strong>
                  <p>{recommendation.experience.reason}</p>
                  <div className="experience-recommendation-hotel">
                    <span>{recommendation.hotel ? "Hotel recomendado" : "Destino sugerido"}</span>
                    <strong>{recommendation.matchLabel}</strong>
                  </div>
                  {recommendation.touristAttractions.length > 0 ? (
                    <div className="experience-attractions" aria-label="Pontos turísticos próximos">
                      {recommendation.touristAttractions.slice(0, 3).map((attraction) => (
                        <span key={`${recommendation.experience.key}-${attraction.name}`}>
                          <AttractionIcon iconType={attraction.iconType} />
                          <span>
                            <strong>{attraction.name}</strong>
                            {attraction.approximateDistanceLabel}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : null}
                  <span className="card-cta-button experience-recommendation-card__link">
                    {recommendation.ctaLabel}
                  </span>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="experience-result-empty" role="status">
            <strong>Não encontramos recomendações para este perfil.</strong>
            <p>Refaça suas escolhas para calibrar melhor as sugestões.</p>
          </div>
        )}

        <div className="experience-step-actions">
          <button
            className="outline-round experience-step-button"
            type="button"
            onClick={handleBack}
          >
            Voltar
          </button>
          <button
            className="outline-round experience-step-button"
            type="button"
            onClick={handleRestart}
          >
            Refazer perfil
          </button>
        </div>

        {experienceHotelsModal}
      </section>
    );
  }

  return (
    <section
      ref={experienceSectionRef}
      id="destinations"
      className="showcase section reveal is-visible"
    >
      <div className="showcase-copy">
        <h2>Experiência sem complicação</h2>
        <p>
          Escolha suas preferências e hospede-se perto do que faz você feliz, com uma reserva
          pensada para conforto do check-in ao check-out.
        </p>

        <div key={activeStep.id} className="experience-question-panel">
          <div className="experience-stepper" aria-label="Pergunta atual">
            <strong>{activeStep.label}</strong>
          </div>

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
        </div>
      </div>

      <div className={`showcase-gallery ${isTransitioning ? "is-transitioning" : ""}`}>
        {renderVisualCard(destinations[0], 0, "featured")}

        <div className="gallery-side">
          {destinations
            .slice(1)
            .map((destination, index) => renderVisualCard(destination, index + 1, "small"))}
        </div>
      </div>

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
        <button
          className="outline-round experience-step-button"
          type="button"
          disabled={!canContinue}
          onClick={handleContinue}
        >
          Continuar
        </button>
      </div>

      {experienceHotelsModal}
    </section>
  );
}
