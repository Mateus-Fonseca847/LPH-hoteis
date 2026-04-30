const CPF_LENGTH = 11;
const PASSPORT_PATTERN = /^[A-Z0-9]{6,12}$/;

function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

function hasRepeatedDigits(value: string) {
  return /^(\d)\1+$/.test(value);
}

function calculateCpfDigit(cpfBase: string, factor: number) {
  let total = 0;

  for (const digit of cpfBase) {
    total += Number(digit) * factor;
    factor -= 1;
  }

  const remainder = total % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}

export function normalizeCpf(value: string) {
  return onlyDigits(value);
}

export function validateCpf(value: string) {
  const cpf = normalizeCpf(value);

  if (cpf.length !== CPF_LENGTH || hasRepeatedDigits(cpf)) {
    return false;
  }

  const firstDigit = calculateCpfDigit(cpf.slice(0, 9), 10);
  const secondDigit = calculateCpfDigit(`${cpf.slice(0, 9)}${firstDigit}`, 11);

  return cpf.endsWith(`${firstDigit}${secondDigit}`);
}

export function normalizePassport(value: string) {
  return value.trim().toUpperCase();
}

export function validatePassport(value: string) {
  return PASSPORT_PATTERN.test(normalizePassport(value));
}

export function normalizeGuestDocument(value: string) {
  const trimmedValue = value.trim();

  if (validateCpf(trimmedValue)) {
    return normalizeCpf(trimmedValue);
  }

  const passport = normalizePassport(trimmedValue);

  if (validatePassport(passport)) {
    return passport;
  }

  return null;
}

export function getGuestDocumentError(value: string) {
  if (onlyDigits(value).length === CPF_LENGTH && !validateCpf(value)) {
    return "CPF inválido. Verifique os números informados.";
  }

  return "Informe um CPF válido ou um passaporte válido.";
}
