const paths: Record<string, string> = {
  user: "M20 21v-2a7 7 0 0 0-14 0v2 M17 7a5 5 0 1 1-10 0 5 5 0 0 1 10 0",
  lock: "M5 10h14v11H5z M8 10V6a4 4 0 0 1 8 0v4 M12 14v3",
  eye: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  "eye-off":
    "M3 3l18 18 M10 5.2c.7-.1 1.3-.2 2-.2 6.5 0 10 7 10 7a19 19 0 0 1-3 3.9 M6.2 6.2A20 20 0 0 0 2 12s3.5 7 10 7c1.8 0 3.4-.5 4.8-1.2 M10 10a3 3 0 0 0 4 4",
  home: "M3 10l9-7 9 7v11H3z M9 21v-9h6v9",
  folder: "M3 5a2 2 0 0 1 2-2h5l3 4h6a2 2 0 0 1 2 2v11H3z",
  layers: "M2 7l10-5 10 5-10 5z M2 12l10 5 10-5 M2 17l10 5 10-5",
  people:
    "M16 21v-3a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v3 M21 21v-3a4 4 0 0 0-3-4 M17 3a4 4 0 0 1 0 8 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  today: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  reservations: "M5 5h14v16H5z M8 3v4 M16 3v4 M8 11h8 M8 15h5",
  rooms: "M4 21V3h13v18 M2 21h19 M8 7h5 M8 11h5 M13 16h.01",
  arrivals: "M14 4h6v16h-6 M3 12h12 M10 7l5 5-5 5",
  stays: "M3 18V8 M3 14h18v4 M7 10h3v4 M10 8h8a3 3 0 0 1 3 3v3",
  payments: "M3 6h18v14H3z M3 10h18 M7 16h4 M6 3h12",
  changes: "M4 7h15 M15 3l4 4-4 4 M20 17H5 M9 13l-4 4 4 4",
  audit: "M6 3h12v18H6z M9 7h6 M9 11h6 M9 15h4",
  analytics: "M4 3v18h17 M8 16v-4 M13 16V8 M18 16V5",
  settings: "M4 6h16 M4 12h16 M4 18h16 M8 3v6 M16 9v6 M10 15v6",
  hall: "M3 21V7l9-4 9 4v14 M7 21V11h10v10 M10 21v-5h4v5",
  reviews: "M4 4h16v12H9l-5 4z M8 8h8 M8 12h5",
  plus: "M12 5v14 M5 12h14",
  arrow: "M5 12h14 M14 7l5 5-5 5",
  logout: "M10 4H4v16h6 M9 12h12 M16 7l5 5-5 5",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  chevron: "M9 5l7 7-7 7",
  clock: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
};

export default function StaffIcon({ name }: { name: string }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={paths[name] ?? paths.reservations} />
    </svg>
  );
}
