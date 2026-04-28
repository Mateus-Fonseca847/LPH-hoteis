import { normalizeText } from "@/lib/normalize-text";

export type RoomBedOption = {
  id: string;
  label: string;
};

export type RoomAmenityOption = {
  id: string;
  label: string;
  aliases?: string[];
};

export const ROOM_BED_OPTIONS: RoomBedOption[] = [
  { id: "single", label: "Cama de solteiro" },
  { id: "double", label: "Cama de casal" },
  { id: "queen", label: "Cama queen" },
  { id: "king", label: "Cama king" },
  { id: "bunk", label: "Beliche" },
  { id: "sofa-bed", label: "Sofa-cama" },
  { id: "child", label: "Cama infantil" },
  { id: "crib", label: "Berco" },
  { id: "futon", label: "Futon" },
  { id: "extra", label: "Cama extra" },
];

export const ROOM_AMENITY_OPTIONS: RoomAmenityOption[] = [
  { id: "air-conditioning", label: "Ar-condicionado", aliases: ["ar condicionado"] },
  { id: "wifi", label: "Wi-Fi no quarto", aliases: ["wifi no quarto", "wi-fi no quarto"] },
  { id: "tv", label: "TV" },
  { id: "smart-tv", label: "Smart TV", aliases: ["smarttv"] },
  { id: "minibar", label: "Frigobar" },
  { id: "safe", label: "Cofre" },
  { id: "desk", label: "Mesa de trabalho" },
  { id: "wardrobe", label: "Guarda-roupa", aliases: ["guarda roupa"] },
  { id: "balcony", label: "Varanda" },
  { id: "sea-view", label: "Vista para o mar", aliases: ["vista mar"] },
  { id: "city-view", label: "Vista para a cidade" },
  { id: "bathtub", label: "Banheira" },
  { id: "hot-shower", label: "Chuveiro quente" },
  { id: "hairdryer", label: "Secador de cabelo" },
  { id: "iron", label: "Ferro de passar" },
  { id: "premium-linens", label: "Roupas de cama premium" },
  { id: "extra-pillows", label: "Travesseiros extras" },
  { id: "blackout", label: "Cortinas blackout" },
  { id: "soundproofing", label: "Isolamento acustico" },
  { id: "daily-housekeeping", label: "Servico de limpeza diario" },
  { id: "bath-amenities", label: "Amenities de banho" },
  { id: "coffee-maker", label: "Cafeteira" },
  { id: "electric-kettle", label: "Chaleira eletrica" },
  { id: "microwave", label: "Micro-ondas", aliases: ["micro ondas"] },
  { id: "kitchenette", label: "Cozinha compacta" },
  { id: "living-area", label: "Area de estar" },
  { id: "sofa", label: "Sofa" },
  { id: "bedside-outlets", label: "Tomadas proximas a cama" },
  { id: "elevator-access", label: "Acesso por elevador" },
  { id: "accessible-room", label: "Quarto acessivel" },
];

function normalizeOptionText(value: string) {
  return normalizeText(value).trim();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findRoomAmenityOptionByLabel(label: string) {
  const normalized = normalizeOptionText(label);

  return ROOM_AMENITY_OPTIONS.find((option) => {
    if (normalizeOptionText(option.label) === normalized) {
      return true;
    }

    return option.aliases?.some((alias) => normalizeOptionText(alias) === normalized);
  });
}

export function parseBedsValue(value: string) {
  const normalizedValue = normalizeOptionText(value);

  return ROOM_BED_OPTIONS.reduce<Record<string, number>>((accumulator, option) => {
    const normalizedLabel = normalizeOptionText(option.label);
    const quantityMatch = normalizedValue.match(
      new RegExp(`(\\d+)\\s*x?\\s*${escapeRegExp(normalizedLabel)}`)
    );

    if (quantityMatch) {
      accumulator[option.id] = Number(quantityMatch[1]);
      return accumulator;
    }

    if (normalizedValue.includes(normalizedLabel)) {
      accumulator[option.id] = 1;
      return accumulator;
    }

    accumulator[option.id] = 0;
    return accumulator;
  }, {});
}

export function buildBedsValue(selectedBeds: Record<string, number>) {
  return ROOM_BED_OPTIONS.map((option) => {
    const quantity = selectedBeds[option.id] ?? 0;

    if (quantity <= 0) {
      return null;
    }

    return `${quantity}x ${option.label}`;
  })
    .filter((value): value is string => Boolean(value))
    .join(" | ");
}

export function canonicalizeBedsValue(value: string) {
  const rawValue = value.trim();

  if (!rawValue) {
    return {
      success: false as const,
      error: "Selecione pelo menos um tipo de cama.",
    };
  }

  const parts = rawValue
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  const selectedBeds: Record<string, number> = {};

  for (const option of ROOM_BED_OPTIONS) {
    selectedBeds[option.id] = 0;
  }

  for (const part of parts.length > 0 ? parts : [rawValue]) {
    const quantityMatch = part.match(/^(\d+)\s*x?\s*(.+)$/i);
    const quantity = quantityMatch ? Number(quantityMatch[1]) : 1;
    const label = quantityMatch ? quantityMatch[2] : part;

    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      return {
        success: false as const,
        error: "Quantidade de camas invalida.",
      };
    }

    const normalizedLabel = normalizeOptionText(label);
    const option = ROOM_BED_OPTIONS.find(
      (item) => normalizeOptionText(item.label) === normalizedLabel
    );

    if (!option) {
      return {
        success: false as const,
        error: "Tipo de cama invalido.",
      };
    }

    if (selectedBeds[option.id] > 0) {
      return {
        success: false as const,
        error: "Nao repita o mesmo tipo de cama.",
      };
    }

    selectedBeds[option.id] = quantity;
  }

  const canonical = buildBedsValue(selectedBeds);

  if (!canonical) {
    return {
      success: false as const,
      error: "Selecione pelo menos um tipo de cama.",
    };
  }

  return {
    success: true as const,
    value: canonical,
  };
}

export function parseRoomAmenityIds(labels: string[]) {
  return new Set(
    labels
      .map((label) => findRoomAmenityOptionByLabel(label)?.id)
      .filter((id): id is string => Boolean(id))
  );
}

export function buildRoomAmenityLabels(selectedAmenityIds: Iterable<string>) {
  const selectedSet = new Set(selectedAmenityIds);

  return ROOM_AMENITY_OPTIONS.filter((option) => selectedSet.has(option.id)).map(
    (option) => option.label
  );
}

export function canonicalizeRoomAmenityLabels(values: string[]) {
  if (values.length === 0) {
    return {
      success: false as const,
      error: "Adicione pelo menos uma comodidade.",
    };
  }

  const normalizedIds = new Set<string>();

  for (const value of values) {
    const option = findRoomAmenityOptionByLabel(value);

    if (!option) {
      return {
        success: false as const,
        error: "Comodidade do quarto invalida.",
      };
    }

    if (normalizedIds.has(option.id)) {
      return {
        success: false as const,
        error: "Nao repita a mesma comodidade do quarto.",
      };
    }

    normalizedIds.add(option.id);
  }

  return {
    success: true as const,
    value: buildRoomAmenityLabels(normalizedIds),
  };
}
