export function normalizeCnpj(value: string) {
  return value.replace(/\D/g, "").slice(0, 14);
}

export function formatCnpj(value: string) {
  const digits = normalizeCnpj(value);
  const first = digits.slice(0, 2);
  const second = digits.slice(2, 5);
  const third = digits.slice(5, 8);
  const branch = digits.slice(8, 12);
  const check = digits.slice(12, 14);

  if (digits.length <= 2) {
    return first;
  }

  if (digits.length <= 5) {
    return `${first}.${second}`;
  }

  if (digits.length <= 8) {
    return `${first}.${second}.${third}`;
  }

  if (digits.length <= 12) {
    return `${first}.${second}.${third}/${branch}`;
  }

  return `${first}.${second}.${third}/${branch}-${check}`;
}

function calculateCnpjDigit(base: string, weights: number[]) {
  const sum = weights.reduce((total, weight, index) => total + Number(base[index]) * weight, 0);
  const remainder = sum % 11;

  return remainder < 2 ? 0 : 11 - remainder;
}

export function isValidCnpj(value: string) {
  const digits = normalizeCnpj(value);

  if (digits.length !== 14) {
    return false;
  }

  if (/^(\d)\1{13}$/.test(digits)) {
    return false;
  }

  const firstDigit = calculateCnpjDigit(digits.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const secondDigit = calculateCnpjDigit(
    `${digits.slice(0, 12)}${firstDigit}`,
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  );

  return digits.endsWith(`${firstDigit}${secondDigit}`);
}
