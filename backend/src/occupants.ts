export type Occupants = { adults: number; children: number; extraBed: boolean };

export function evaluateOccupants(category: string, value: Occupants) {
  if (
    !["double_standard", "family_executive"].includes(category) ||
    !Number.isSafeInteger(value.adults) ||
    value.adults < 1 ||
    !Number.isSafeInteger(value.children) ||
    value.children < 0 ||
    typeof value.extraBed !== "boolean" ||
    (category === "double_standard" && value.extraBed)
  )
    return null;
  const people = value.adults + value.children;
  return {
    adults: value.adults,
    children: value.children,
    extraBedCentavos:
      category === "family_executive" && value.extraBed ? 10000 : 0,
    advisory:
      category === "double_standard"
        ? people > 2
          ? "Above usual Double Standard occupancy; staff review required."
          : null
        : people > 3
          ? "Above usual Family Executive occupancy; staff review required."
          : null,
    legalLimitVerified: false,
  };
}
