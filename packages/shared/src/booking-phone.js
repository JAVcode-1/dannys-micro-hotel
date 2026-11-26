export function normalizePhilippineMobile(value) {
  if (typeof value !== "string" || value.length > 30 || /[^+0-9 -]/.test(value))
    return null;

  const number = value.replace(/[ -]/g, "").replace(/^0/, "+63");
  return /^\+639[0-9]{9}$/.test(number) ? number : null;
}
