import { useEffect, useId, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { Link, useLocation } from "react-router";
import StaffIcon from "./StaffIcon";
import StaffNavBadge from "./StaffNavBadge";
import type { StaffNavCounts } from "./StaffNavBadge";

export type MobileNavGroup = {
  label: string;
  icon: string;
  entries: { path: string; label: string; icon: string }[];
};

const shortLabels: Record<string, string> = {
  "/staff/reservations": "Bookings",
  "/staff/stays": "Active stays",
  "/staff/reschedules": "Reschedule",
  "/staff/stay-changes": "Extensions",
  "/staff/cancellations": "Refunds",
  "/staff/audit": "Audit",
  "/staff/hall": "Hall",
  "/staff/reviews": "Reviews",
  "/staff/feedback": "Feedback",
};

export default function StaffMobileNavigation({
  groups,
  identity,
  onSignOut,
  counts = {},
}: {
  groups: MobileNavGroup[];
  identity?: string;
  onSignOut?: () => void;
  counts?: StaffNavCounts;
}) {
  const { pathname } = useLocation();
  const [mobile, setMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      !!window.matchMedia?.("(max-width: 63.99rem)").matches,
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [lastSelected, setLastSelected] = useState("Today");
  const [allOptions, setAllOptions] = useState(false);
  const triggers = useRef<Record<string, HTMLButtonElement | null>>({});
  const list = useRef<HTMLDivElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const wasAllOptions = useRef(false);
  const actionsId = useId();
  const today: MobileNavGroup = {
    label: "Today",
    icon: "plus",
    entries: [
      { path: "/staff", label: "Overview", icon: "home" },
      { path: "/staff/check-ins", label: "Check-in", icon: "arrivals" },
      { path: "/staff/walkins", label: "Walk-in", icon: "plus" },
    ],
  };
  const tabs = [groups[0], groups[1], today, groups[2], groups[3]].filter(
    Boolean,
  );
  const current = tabs.find(
    (group) => group.label === (selected ?? lastSelected),
  );
  const activeGroup =
    pathname === "/staff"
      ? "Today"
      : groups.find((group) =>
          group.entries.some(
            ({ path }) =>
              pathname === path ||
              (path === "/staff/reservations" &&
                pathname.startsWith(`${path}/`)),
          ),
        )?.label;

  function close(restoreFocus = true) {
    setSelected(null);
    setAllOptions(false);
    if (restoreFocus && selected) triggers.current[selected]?.focus();
  }

  useEffect(() => {
    const query = window.matchMedia?.("(max-width: 63.99rem)");
    if (!query) return;
    const change = () => {
      setMobile(query.matches);
      setSelected(null);
      setAllOptions(false);
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    setSelected(null);
    setAllOptions(false);
  }, [pathname]);
  useEffect(() => {
    if (!selected) return;
    setLastSelected(selected);
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setSelected(null);
        setAllOptions(false);
        triggers.current[selected!]?.focus();
      }
    }
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [selected]);
  useEffect(() => {
    if (allOptions) list.current?.querySelector("a")?.focus();
    else if (wasAllOptions.current && selected) moreButton.current?.focus();
    wasAllOptions.current = allOptions;
  }, [allOptions, selected]);

  if (!mobile) return null;
  const overflow = (current?.entries.length ?? 0) > 3;
  const actions = overflow
    ? current!.entries.slice(0, 2)
    : (current?.entries ?? []);
  const positions =
    actions.length === 1
      ? [[0, -96]]
      : actions.length === 2 && !overflow
        ? [
            [-64, -72],
            [64, -72],
          ]
        : [
            [-82, -48],
            [0, -96],
            [82, -48],
          ];

  return (
    <div
      className="staff-mobile-navigation print:hidden"
      data-open={!!selected}
      data-list={allOptions}
      onBlur={(event) => {
        if (
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        )
          close(false);
      }}
    >
      <button
        type="button"
        className="staff-mobile-scrim"
        aria-label="Close navigation actions"
        tabIndex={-1}
        aria-hidden={!selected}
        onClick={() => close()}
      />
      <nav className="staff-bottom-bar" aria-label="Mobile staff navigation">
        {tabs.map((group) =>
          group.label === "Today" ? (
            <div key="Today" className="staff-bottom-center-cell">
              <button
                type="button"
                className="staff-bottom-today"
                aria-label={
                  selected
                    ? "Close Today navigation actions"
                    : "Open Today navigation actions"
                }
                ref={(element) => {
                  triggers.current.Today = element;
                }}
                aria-expanded={!!selected}
                aria-controls={actionsId}
                aria-current={activeGroup === "Today" ? "page" : undefined}
                onClick={() => {
                  if (selected) close();
                  else {
                    setSelected("Today");
                    setAllOptions(false);
                  }
                }}
              >
                <StaffIcon name="plus" />
              </button>
              <span>Today</span>
            </div>
          ) : (
            <button
              key={group.label}
              type="button"
              className="staff-bottom-tab"
              ref={(element) => {
                triggers.current[group.label] = element;
              }}
              aria-expanded={selected === group.label}
              aria-controls={actionsId}
              aria-current={activeGroup === group.label ? "page" : undefined}
              disabled={!group.entries.length}
              onClick={() => {
                setSelected(selected === group.label ? null : group.label);
                setAllOptions(false);
              }}
            >
              <StaffIcon name={group.icon} />
              <span>
                {group.label === "Booking changes" ? "Changes" : group.label}
              </span>
              <StaffNavBadge
                count={group.entries.reduce(
                  (sum, entry) => sum + (counts[entry.path] ?? 0),
                  0,
                )}
              />
            </button>
          ),
        )}
        <div
          id={actionsId}
          className="staff-mobile-actions"
          aria-label={selected ? `${selected} actions` : "Navigation actions"}
          inert={!selected}
          aria-hidden={!selected}
        >
          <div
            className="staff-mobile-fan"
            inert={allOptions}
            aria-hidden={allOptions}
          >
            {actions.map((action, index) => (
              <Link
                key={action.path}
                to={action.path}
                onClick={() => close(false)}
                className="staff-mobile-action"
                tabIndex={selected && !allOptions ? 0 : -1}
                style={
                  {
                    "--action-x": `${positions[index][0]}px`,
                    "--action-y": `${positions[index][1]}px`,
                    "--action-delay": `${index * 40}ms`,
                  } as CSSProperties
                }
              >
                <StaffIcon name={action.icon} />
                <span>{shortLabels[action.path] ?? action.label}</span>
                <StaffNavBadge count={counts[action.path]} path={action.path} />
              </Link>
            ))}
            {overflow && (
              <button
                ref={moreButton}
                type="button"
                className="staff-mobile-action"
                tabIndex={selected && !allOptions ? 0 : -1}
                style={
                  {
                    "--action-x": "82px",
                    "--action-y": "-48px",
                    "--action-delay": "80ms",
                  } as CSSProperties
                }
                onClick={() => setAllOptions(true)}
              >
                <StaffIcon name="menu" />
                <span>All options</span>
              </button>
            )}
          </div>
          {allOptions && (
            <div
              ref={list}
              className="staff-mobile-options"
              aria-label={`${selected} destinations`}
            >
              <div>
                <strong>{selected}</strong>
                <button type="button" onClick={() => setAllOptions(false)}>
                  Back
                </button>
              </div>
              {current?.entries.map((entry) => (
                <Link
                  key={entry.path}
                  to={entry.path}
                  aria-current={pathname === entry.path ? "page" : undefined}
                  onClick={() => close(false)}
                >
                  <StaffIcon name={entry.icon} />
                  <span className="staff-nav-label">{entry.label}</span>
                  <StaffNavBadge count={counts[entry.path]} path={entry.path} />
                  <StaffIcon name="arrow" />
                </Link>
              ))}
              {selected === "Management" && onSignOut && (
                <div className="staff-mobile-account">
                  <span>{identity}</span>
                  <button
                    type="button"
                    onClick={() => {
                      close(false);
                      onSignOut();
                    }}
                  >
                    Sign out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>
    </div>
  );
}
