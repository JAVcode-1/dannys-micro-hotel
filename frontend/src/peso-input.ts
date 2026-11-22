/** Parse displayed PHP amounts without floating-point multiplication. */
export function parsePesoInput(input: string): number {
  const value = input.trim().replace(/^₱\s*/, "");
  if (!/^(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d{1,2})?$/.test(value))
    throw new Error("Enter a PHP amount with up to two decimal places.");
  const [whole, fraction = ""] = value.replaceAll(",", "").split(".");
  const centavos = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (centavos > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("PHP amount is too large.");
  return Number(centavos);
}

export function pesoInputValue(centavos: number): string {
  if (!Number.isSafeInteger(centavos) || centavos < 0)
    throw new Error("Invalid PHP amount.");
  return `${Math.floor(centavos / 100)}.${String(centavos % 100).padStart(2, "0")}`;
}
