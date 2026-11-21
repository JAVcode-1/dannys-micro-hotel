import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import {
  NavLink,
  Navigate,
  Outlet,
  Route,
  useLocation,
  useMatch,
  useNavigate,
  useOutletContext,
} from "react-router";
import CancellationDesk from "./CancellationDesk";
import CheckInDesk from "./CheckInDesk";
import HallDesk from "./HallDesk";
import OperationalSettings from "./OperationalSettings";
import RescheduleDesk from "./RescheduleDesk";
import StaffAnalytics from "./StaffAnalytics";
import StaffAuditDesk from "./StaffAuditDesk";
import StaffCatalog from "./StaffCatalog";
import StaffLogin from "./StaffLogin";
import StaffPaymentReviews from "./StaffPaymentReviews";
import StaffReviewDesk from "./StaffReviewDesk";
import StaffRooms from "./StaffRooms";
import StaffReservations, {
  StaffDashboard,
  StaffReservationDetail,
} from "./StaffReservations";
import { StaffSessionProvider, useStaffSession } from "./StaffSession";
import StayChangesDesk from "./StayChangesDesk";
import StayMonitor from "./StayMonitor";
import WalkInDesk from "./WalkInDesk";
import { staffAuth } from "./staff-auth";

const signInPath = "/staff/sign-in";

type Page = {
  path: string;
  label: string;
  component: ComponentType<{ token: string }>;
  wide?: boolean;
};

const primaryPages: Page[] = [
  {
    path: "/staff/cancellations",
    label: "Cancellations and refunds",
    component: CancellationDesk,
    wide: true,
  },
  {
    path: "/staff/stays",
    label: "Stays and checkout",
    component: StayMonitor,
    wide: true,
  },
  {
    path: "/staff/check-ins",
    label: "Check-in",
    component: CheckInDesk,
    wide: true,
  },
  {
    path: "/staff/walkins",
    label: "Walk-ins",
    component: WalkInDesk,
    wide: true,
  },
  {
    path: "/staff/payments",
    label: "Payments",
    component: StaffPaymentReviews,
    wide: true,
  },
  { path: "/staff", label: "Today", component: StaffDashboard, wide: true },
  {
    path: "/staff/reservations",
    label: "Reservations",
    component: StaffReservations,
    wide: true,
  },
  {
    path: "/staff/settings/catalog",
    label: "Catalog",
    component: StaffCatalog,
    wide: true,
  },
  { path: "/staff/rooms", label: "Rooms", component: StaffRooms, wide: true },
  {
    path: "/staff/settings",
    label: "Settings",
    component: OperationalSettings,
    wide: true,
  },
];

const additionalPages: Page[] = [
  {
    path: "/staff/reschedules",
    label: "Rescheduling",
    component: RescheduleDesk,
  },
  {
    path: "/staff/stay-changes",
    label: "Extensions and charges",
    component: StayChangesDesk,
    wide: true,
  },
  {
    path: "/staff/audit",
    label: "Staff audit",
    component: StaffAuditDesk,
    wide: true,
  },
  {
    path: "/staff/analytics",
    label: "Analytics",
    component: StaffAnalytics,
    wide: true,
  },
];

const reviewPages: Page[] = [
  {
    path: "/staff/reviews",
    label: "Review moderation",
    component: StaffReviewDesk,
  },
  {
    path: "/staff/feedback",
    label: "Private feedback",
    component: ({ token }) => <StaffReviewDesk token={token} feedback />,
  },
];

const hallPage: Page = {
  path: "/staff/hall",
  label: "Function Hall",
  component: HallDesk,
  wide: true,
};

function StaffPage({ component: Component }: Pick<Page, "component">) {
  return <Component token={useOutletContext<string>()} />;
}

function StaffLayout({
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
  pages: Page[];
  reviewsEnabled: boolean;
  hallEnabled: boolean;
  notice: string;
}) {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const wide = pages.some((page) => page.wide && page.path === pathname);
  const groups = [
    ["Today", ["/staff", "/staff/check-ins"]],
    [
      "Reservations",
      [
        "/staff/reservations",
        "/staff/walkins",
        "/staff/cancellations",
        "/staff/reschedules",
      ],
    ],
    ["Active Stays", ["/staff/stays", "/staff/stay-changes"]],
    ["Payments", ["/staff/payments"]],
    ["Rooms", ["/staff/rooms"]],
    ["Function Hall", hallEnabled ? ["/staff/hall"] : []],
    [
      "Management",
      [
        "/staff/analytics",
        "/staff/audit",
        "/staff/settings",
        "/staff/settings/catalog",
        ...(reviewsEnabled ? ["/staff/reviews", "/staff/feedback"] : []),
      ],
    ],
  ] as const;

  async function signOut() {
    setMessage("");
    try {
      const { error } = await authClient.auth.signOut();
      if (error) throw error;
    } catch {
      setMessage("Sign-out failed. Please try again.");
    }
  }

  return (
    <section
      className={`mx-auto min-w-0 rounded-2xl border border-subtle bg-white p-4 sm:p-7 shadow-sm ${wide || pathname.startsWith("/staff/reservations/") ? "max-w-6xl" : "max-w-3xl"}`}
    >
      <h1 className="text-2xl font-bold text-main">Staff workspace</h1>
      <p className="mt-3 [overflow-wrap:anywhere]">Signed in as {identity}</p>
      <div className="mt-6 grid gap-6 md:grid-cols-[14rem_minmax(0,1fr)]">
        <aside className="border-subtle md:border-r md:pr-4 print:hidden">
          <nav
            aria-label="Staff navigation"
            className="grid gap-5 sm:grid-cols-2 md:grid-cols-1"
          >
            {groups
              .filter(([, paths]) => paths.length)
              .map(([group, paths]) => (
                <div key={group}>
                  <p className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
                    {group}
                  </p>
                  {paths.map((path) => {
                    const page = pages.find((p) => p.path === path);
                    return page ? (
                      <NavLink
                        key={path}
                        to={path}
                        end
                        className={({ isActive }) =>
                          `flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-primary ${isActive ? "bg-selected" : ""}`
                        }
                      >
                        {page.label}
                      </NavLink>
                    ) : null;
                  })}
                </div>
              ))}
          </nav>
        </aside>
        <div className="min-w-0">
          <Outlet context={token} />
          <button
            className="mt-4 rounded-lg bg-primary px-4 py-2 text-white"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </div>
      </div>
      {(message || notice) && (
        <p role="status" className="mt-4 text-sm text-muted">
          {message || notice}
        </p>
      )}
    </section>
  );
}

type StaffOptions = {
  authClient?: typeof staffAuth;
  reviewsEnabled: boolean;
  hallEnabled: boolean;
  invitePath: string | null;
};

function StaffRouteGuard({
  authClient = staffAuth,
  invitePath,
  ...layout
}: StaffOptions & { pages: Page[] }) {
  const { access, hasSession, restored, recovering, finishRecovery } =
    useStaffSession();
  const location = useLocation();
  const isSignIn = !!useMatch(signInPath);
  const navigate = useNavigate();
  const [invited, setInvited] = useState(!!invitePath);
  const [cleanInviteUrl, setCleanInviteUrl] = useState(!!invitePath);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (cleanInviteUrl && restored) {
      setCleanInviteUrl(false);
      void navigate("/staff", { replace: true });
    }
  }, [cleanInviteUrl, navigate, restored]);

  if (!authClient)
    return (
      <p className="text-muted">
        Staff sign-in is not configured for this preview.
      </p>
    );

  if (hasSession && (invited || recovering))
    return (
      <StaffLogin
        authClient={authClient}
        passwordMode={invited ? "invite" : "recovery"}
        onPasswordUpdated={() => {
          setNotice(
            invited
              ? "Password set. Staff access requires activation."
              : "Password updated.",
          );
          setInvited(false);
          finishRecovery();
        }}
      />
    );

  if (access.status === "loading" || cleanInviteUrl)
    return (
      <p className="text-muted" role="status">
        Verifying staff session…
      </p>
    );

  if (access.status === "unauthenticated") {
    if (!isSignIn)
      return (
        <Navigate
          to={signInPath}
          replace
          state={{ returnTo: location.pathname + location.search }}
        />
      );

    return (
      <StaffLogin
        authClient={authClient}
        onPasswordUpdated={finishRecovery}
        sessionMessage={notice || access.message}
      />
    );
  }

  if (isSignIn)
    return <Navigate to={location.state?.returnTo || "/staff"} replace />;

  return (
    <StaffLayout
      authClient={authClient}
      token={access.token}
      identity={access.identity}
      notice={notice}
      {...layout}
    />
  );
}

export function staffRoutes(options: StaffOptions) {
  const pages = [
    ...primaryPages,
    ...additionalPages,
    ...(options.reviewsEnabled ? reviewPages : []),
    ...(options.hallEnabled ? [hallPage] : []),
  ];

  return (
    <Route
      element={
        <main className="min-h-svh bg-canvas px-6 py-16 text-main">
          <StaffSessionProvider authClient={options.authClient}>
            <StaffRouteGuard {...options} pages={pages} />
          </StaffSessionProvider>
        </main>
      }
    >
      {pages.map(({ path, component }) => (
        <Route
          key={path}
          path={path}
          element={<StaffPage component={component} />}
        />
      ))}
      <Route
        path="/staff/reservations/:id"
        element={<StaffPage component={StaffReservationDetail} />}
      />
      <Route
        path="/staff/catalog"
        element={<Navigate to="/staff/settings/catalog" replace />}
      />
      {!options.hallEnabled && (
        <Route
          path="/staff/hall"
          element={<p>Function Hall is unavailable pending activation.</p>}
        />
      )}
      {!options.reviewsEnabled && (
        <Route
          path="/staff/reviews"
          element={<p>Reviews are unavailable pending activation.</p>}
        />
      )}
      {!options.reviewsEnabled && (
        <Route
          path="/staff/feedback"
          element={<p>Private feedback is unavailable pending activation.</p>}
        />
      )}
      <Route path={signInPath} element={null} />
      {options.invitePath && <Route path={options.invitePath} element={null} />}
    </Route>
  );
}
