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
  { path: "/staff", label: "Catalog", component: StaffCatalog },
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
      className={`mx-auto rounded-2xl border border-subtle bg-white p-7 shadow-sm ${wide ? "max-w-6xl" : "max-w-md"}`}
    >
      <h1 className="text-2xl font-bold text-main">Staff workspace</h1>
      <div className="mt-6">
        <p>Signed in as {identity}</p>
        <nav className="mt-5 flex flex-wrap gap-2 text-sm font-semibold">
          {primaryPages.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              end
              className="rounded-lg bg-selected px-3 py-2 text-primary"
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <nav className="flex flex-wrap gap-4 text-primary">
          {additionalPages.map(({ path, label }) => (
            <NavLink
              key={path}
              to={path}
              className="inline-flex min-h-11 items-center"
            >
              {label}
            </NavLink>
          ))}
        </nav>
        {reviewsEnabled && (
          <nav className="flex flex-wrap gap-4 py-2 text-primary">
            {reviewPages.map(({ path, label }) => (
              <NavLink key={path} to={path}>
                {label}
              </NavLink>
            ))}
          </nav>
        )}
        {hallEnabled && (
          <NavLink
            to={hallPage.path}
            className="inline-flex min-h-11 items-center pl-4 text-primary"
          >
            {hallPage.label}
          </NavLink>
        )}
        <Outlet context={token} />
        <button
          className="mt-4 rounded-lg bg-primary px-4 py-2 text-white"
          onClick={() => void signOut()}
        >
          Sign out
        </button>
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
      <Route path={signInPath} element={null} />
      {options.invitePath && <Route path={options.invitePath} element={null} />}
    </Route>
  );
}
