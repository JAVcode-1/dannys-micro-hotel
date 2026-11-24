import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import type { ComponentType } from "react";
import { Link, NavLink, Outlet, useLocation } from "react-router";
import { notifySuccess } from "./notifications";
import { staffAuth } from "./staff-auth";
import StaffIcon from "./StaffIcon";
import StaffMobileNavigation from "./StaffMobileNavigation";

export type StaffPageDefinition = {
  path: string;
  label: string;
  component: ComponentType<{ token: string }>;
};

const icons: Record<string, string> = {
  "/staff": "home",
  "/staff/reservations": "reservations",
  "/staff/check-ins": "arrivals",
  "/staff/stays": "stays",
  "/staff/payments": "payments",
  "/staff/rooms": "rooms",
  "/staff/analytics": "analytics",
  "/staff/audit": "audit",
  "/staff/settings": "settings",
  "/staff/settings/catalog": "settings",
  "/staff/hall": "hall",
  "/staff/reviews": "reviews",
  "/staff/feedback": "reviews",
  "/staff/walkins": "plus",
  "/staff/reschedules": "changes",
  "/staff/stay-changes": "changes",
  "/staff/cancellations": "changes",
};

const groupIcons: Record<string, string> = {
  "Front desk": "folder",
  Property: "layers",
  "Booking changes": "changes",
  Management: "people",
};

function StaffNavGroup({
  label,
  entries,
  closeMenu,
  open,
  toggle,
}: {
  label: string;
  entries: StaffPageDefinition[];
  closeMenu: () => void;
  open: boolean;
  toggle: () => void;
}) {
  const contentId = useId();

  if (!entries.length) return null;
  return (
    <div className="staff-nav-group" data-open={open}>
      <button
        type="button"
        className="staff-nav-group-toggle"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={toggle}
      >
        <StaffIcon name={groupIcons[label]} />
        <span>{label}</span>
        <span className="staff-nav-chevron">
          <StaffIcon name="chevron" />
        </span>
      </button>
      <div
        id={contentId}
        className="staff-nav-children"
        inert={!open}
        aria-hidden={!open}
      >
        <div className="staff-nav-children-inner">
          {entries.map((entry, index) => (
            <NavLink
              key={entry.path}
              to={entry.path}
              end={entry.path !== "/staff/reservations"}
              onClick={closeMenu}
              style={{
                transitionDelay: open ? `${100 + index * 55}ms` : "0ms",
              }}
              className={({ isActive }) =>
                `staff-nav-link ${isActive ? "is-active" : ""}`
              }
            >
              <StaffIcon name={icons[entry.path]} />
              <span>{entry.label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function StaffWorkspaceLayout({
  authClient,
  identity,
  token,
  pages,
  reviewsEnabled,
  hallEnabled,
  notice,
}: {
  authClient: NonNullable<typeof staffAuth>;
  identity: string;
  token: string;
  pages: StaffPageDefinition[];
  reviewsEnabled: boolean;
  hallEnabled: boolean;
  notice: string;
}) {
  const { pathname } = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupChoice, setGroupChoice] = useState<{
    pathname: string;
    label: string | null;
  }>({ pathname: "", label: null });
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(() => new Date());
  const menuButton = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const previousPath = useRef(pathname);
  const navigationDirection = useRef(1);
  const navigation = useRef<HTMLElement>(null);
  const selection = useRef<HTMLSpanElement>(null);
  const navigationMotion = useRef<Animation | null>(null);
  useEffect(() => () => navigationMotion.current?.cancel(), []);
  useEffect(() => {
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    if (
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
      document.activeElement?.matches(":focus-visible")
    )
      return;
    const animation = content.current?.animate?.(
      [
        { opacity: 0.65, transform: `translateY(${-16 * navigationDirection.current}px)` },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 250, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
    );
    return () => animation?.cancel();
  }, [pathname]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => setMenuOpen(false), [pathname]);
  const page = pages.find((entry) => entry.path === pathname);
  const title =
    page?.label ??
    (pathname.startsWith("/staff/reservations/")
      ? "Reservation details"
      : "Staff workspace");
  const groups = [
    [
      "Front desk",
      [
        "/staff/reservations",
        "/staff/check-ins",
        "/staff/stays",
        "/staff/walkins",
        "/staff/payments",
      ],
    ],
    ["Property", ["/staff/rooms", ...(hallEnabled ? ["/staff/hall"] : [])]],
    [
      "Booking changes",
      ["/staff/reschedules", "/staff/stay-changes", "/staff/cancellations"],
    ],
    [
      "Management",
      [
        "/staff/analytics",
        "/staff/audit",
        ...(reviewsEnabled ? ["/staff/reviews", "/staff/feedback"] : []),
        "/staff/settings/catalog",
        "/staff/settings",
      ],
    ],
  ] as const;
  const routeGroup = groups.find(([, paths]) =>
    paths.some(
      (path) =>
        pathname === path ||
        (path === "/staff/reservations" && pathname.startsWith(`${path}/`)),
    ),
  );
  const openGroup =
    groupChoice.pathname === pathname
      ? groupChoice.label
      : (routeGroup?.[0] ?? "Front desk");

  useLayoutEffect(() => {
    const nav = navigation.current;
    const indicator = selection.current;
    if (!nav || !indicator) return;
    function positionSelection() {
      const active = nav!.querySelector<HTMLElement>('[aria-current="page"]');
      if (!active || active.closest("[inert]")) {
        indicator!.style.opacity = "0";
        return;
      }
      const bounds = active.getBoundingClientRect();
      const container = nav!.getBoundingClientRect();
      indicator!.style.width = `${bounds.width}px`;
      indicator!.style.height = `${bounds.height}px`;
      indicator!.style.transform = `translate(${bounds.left - container.left + nav!.scrollLeft}px, ${bounds.top - container.top + nav!.scrollTop}px)`;
      indicator!.style.opacity = "1";
    }
    positionSelection();
    // Follow the original accordion animation without moving or remounting links.
    const observer = new ResizeObserver(positionSelection);
    observer.observe(nav);
    nav.querySelectorAll(".staff-nav-children").forEach((group) => observer.observe(group));
    return () => observer.disconnect();
  }, [pathname, openGroup]);

  async function signOut() {
    setMessage("");
    try {
      const { error } = await authClient.auth.signOut();
      if (error) throw error;
      notifySuccess("Signed out successfully.");
    } catch {
      setMessage("Sign-out failed. Please try again.");
    }
  }

  return (
    <div
      className="staff-shell"
      onClickCapture={(event) => {
        if (
          event.detail === 0 ||
          window.matchMedia("(prefers-reduced-motion: reduce)").matches
        )
          return;
        const control = (event.target as Element).closest<HTMLElement>(
          'a[href^="/staff"], .staff-navigation button, .staff-mobile-navigation button, .staff-content nav button',
        );
        if (!control || control.classList.contains("staff-mobile-scrim")) return;
        const links = Array.from(
          navigation.current?.querySelectorAll<HTMLAnchorElement>(".staff-nav-link") ?? [],
        );
        const currentIndex = links.findIndex((link) => link.getAttribute("aria-current") === "page");
        const destination = control.getAttribute("href")?.split("?")[0];
        const nextIndex = links.findIndex((link) => link.getAttribute("href") === destination);
        navigationDirection.current = nextIndex >= 0 && currentIndex >= 0
          ? (nextIndex >= currentIndex ? 1 : -1)
          : (control.getAttribute("aria-expanded") === "true" ? -1 : 1);
        navigationMotion.current?.cancel();
        // Independent translate preserves the mobile fan's existing transforms.
        navigationMotion.current =
          control.animate?.(
            [
              { translate: `0 ${-6 * navigationDirection.current}px`, opacity: 0.65 },
              { translate: "0 0", opacity: 1 },
            ],
            { duration: 200, easing: "cubic-bezier(0.23, 1, 0.32, 1)" },
          ) ?? null;
      }}
    >
      <a className="staff-skip" href="#staff-content">
        Skip to workspace
      </a>
      <aside className="staff-sidebar print:hidden">
        <div className="staff-brand-row">
          <Link
            to="/staff"
            className="staff-brand"
            aria-label="Danny's Micro Hotel staff home"
          >
            <img
              className="staff-brand-logo"
              src="/hotel/logo.webp"
              width="238"
              height="225"
              alt=""
            />
            <span>
              Danny’s <strong>Micro Hotel</strong>
              <small>STAYTRACK · STAFF WORKSPACE</small>
            </span>
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="staff-menu-button"
            aria-expanded={menuOpen}
            aria-controls="staff-navigation"
            aria-label={menuOpen ? "Close staff menu" : "Open staff menu"}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            <StaffIcon name="menu" />
          </button>
        </div>
        <div
          id="staff-navigation"
          className={`staff-navigation-wrap ${menuOpen ? "is-open" : ""}`}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setMenuOpen(false);
              menuButton.current?.focus();
            }
          }}
        >
          <nav
            ref={navigation}
            aria-label="Staff navigation"
            className="staff-navigation"
            onKeyDown={(event) => {
              if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
              const items = Array.from(
                event.currentTarget.querySelectorAll<HTMLElement>(
                  '.staff-nav-overview, .staff-nav-group-toggle, .staff-nav-group[data-open="true"] .staff-nav-link',
                ),
              );
              const index = items.indexOf(
                (event.target as HTMLElement).closest<HTMLElement>(
                  "button, a",
                )!,
              );
              if (index < 0) return;
              event.preventDefault();
              items[
                (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) %
                  items.length
              ]?.focus();
            }}
          >
            <span ref={selection} className="staff-nav-selection" aria-hidden="true" />
            <NavLink
              to="/staff"
              end
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `staff-nav-link staff-nav-overview ${isActive ? "is-active" : ""}`
              }
            >
              <StaffIcon name="home" />
              <span>Today</span>
            </NavLink>
            {groups.map(([label, paths]) => (
              <StaffNavGroup
                key={label}
                label={label}
                open={openGroup === label}
                toggle={() =>
                  setGroupChoice({
                    pathname,
                    label: openGroup === label ? null : label,
                  })
                }
                entries={paths.flatMap((path) =>
                  pages.filter((entry) => entry.path === path),
                )}
                closeMenu={() => setMenuOpen(false)}
              />
            ))}
          </nav>
          <div className="staff-account">
            <span className="staff-avatar" aria-hidden="true">
              {identity.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <strong title={`Signed in as ${identity}`}>
                Signed in as {identity}
              </strong>
              <span>Staff / Admin</span>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              aria-label="Sign out"
              title="Sign out"
            >
              <StaffIcon name="logout" />
            </button>
          </div>
        </div>
      </aside>
      <div className="staff-work-area">
        <header className="staff-topbar print:hidden">
          <div className="staff-mobile-header-brand">
            <img
              className="staff-mobile-header-logo"
              src="/hotel/logo.webp"
              width="238"
              height="225"
              alt=""
            />
            <span>
              Danny’s <strong>Micro Hotel</strong>
            </span>
          </div>
          <div>
            <p className="staff-eyebrow">
              Danny’s Micro Hotel <span>/</span> Workspace
            </p>
            <h1 className="staff-page-title">{title}</h1>
          </div>
          <div className="staff-topbar-actions">
            <div className="staff-date">
              <time
                dateTime={new Intl.DateTimeFormat("en-CA", {
                  timeZone: "Asia/Manila",
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                }).format(now)}
              >
                {now.toLocaleDateString("en-PH", {
                  timeZone: "Asia/Manila",
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
              <span>Asia/Manila</span>
            </div>
            <Link to="/staff/walkins" className="staff-primary-action">
              <StaffIcon name="plus" />
              New walk-in
            </Link>
          </div>
        </header>
        <div
          ref={content}
          id="staff-content"
          tabIndex={-1}
          className="staff-content"
        >
          {(message || notice) && (
            <p role="status" className="staff-notice">
              {message || notice}
            </p>
          )}
          <Outlet context={{ token, hallEnabled, signOut }} />
        </div>
      </div>
      <StaffMobileNavigation
        groups={groups.map(([label, paths]) => ({
          label,
          icon: groupIcons[label],
          entries: paths.flatMap((path) =>
            pages
              .filter((entry) => entry.path === path)
              .map((entry) => ({
                path: entry.path,
                label: entry.label,
                icon: icons[path],
              })),
          ),
        }))}
        identity={identity}
        onSignOut={() => void signOut()}
      />
    </div>
  );
}
