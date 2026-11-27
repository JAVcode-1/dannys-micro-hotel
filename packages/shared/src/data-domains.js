export const dataDomains = [
  "reservation",
  "payment",
  "stay",
  "room",
  "hall",
  "catalog",
  "settings",
  "review",
  "notification",
];

export function writeDomain(method, path) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return;
  const [route] = path.split("?");
  if (route.endsWith("/quote") || route.endsWith("-quote")) return;
  if (/^\/staff\/catalog(?:\/|$)/.test(route)) return "catalog";
  if (/^\/staff\/settings(?:\/|$)/.test(route)) return "settings";
  if (/^\/staff\/rooms(?:\/|$)/.test(route)) return "room";
  if (
    /^\/staff\/(?:check-ins|stays|stay-changes|stay-extensions|stay-charges|stay-receipts|stay-allocations|stay-reviews)(?:\/|$)/.test(
      route,
    )
  )
    return "stay";
  if (/^\/(?:staff|guest)\/hall(?:\/|$)/.test(route)) return "hall";
  if (
    /^\/(?:staff|guest)\/(?:payment-reviews|payment-qr|payments|refund-issues)(?:\/|$)/.test(
      route,
    ) ||
    /\/walkins\/[^/]+\/payments$/.test(route)
  )
    return "payment";
  if (
    /^\/(?:staff|guest)\/(?:reservations|walkins|cancellations|reschedules)(?:\/|$)/.test(
      route,
    )
  )
    return "reservation";
  if (
    /^\/(?:staff\/)?(?:reviews|private-feedback|review-enrollment|review-invitations)(?:\/|$)/.test(
      route,
    )
  )
    return "review";
}
