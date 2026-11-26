import { useEffect, useState } from "react";
import type { ComponentType } from "react";
import StaffLayout from "./StaffWorkspaceLayout";
import {
  Navigate,
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
};

const primaryPages: Page[] = [
  {
    path: "/staff/cancellations",
    label: "Cancellations and refunds",
    component: CancellationDesk,
  },
  {
    path: "/staff/stays",
    label: "Stays and checkout",
    component: StayMonitor,
  },
  {
    path: "/staff/check-ins",
    label: "Check-in",
    component: CheckInDesk,
  },
  {
    path: "/staff/walkins",
    label: "Walk-ins",
    component: WalkInDesk,
  },
  {
    path: "/staff/payments",
    label: "Payments",
    component: StaffPaymentReviews,
  },
  { path: "/staff", label: "Today", component: StaffDashboardPage },
  {
    path: "/staff/reservations",
    label: "Reservations",
    component: StaffReservations,
  },
  {
    path: "/staff/settings/catalog",
    label: "Catalog",
    component: StaffCatalog,
  },
  { path: "/staff/rooms", label: "Rooms", component: StaffRooms },
  {
    path: "/staff/settings",
    label: "Settings",
    component: OperationalSettings,
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
  },
  {
    path: "/staff/audit",
    label: "Staff audit",
    component: StaffAuditDesk,
  },
  {
    path: "/staff/analytics",
    label: "Analytics",
    component: StaffAnalyticsPage,
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
};

function StaffDashboardPage({ token }: { token: string }) {
  const { hallEnabled, identity } = useOutletContext<{
    hallEnabled: boolean;
    identity: string;
  }>();
  return (
    <StaffDashboard token={token} hallEnabled={hallEnabled} identity={identity} />
  );
}

function StaffAnalyticsPage({ token }: { token: string }) {
  const { hallEnabled } = useOutletContext<{ hallEnabled: boolean }>();
  return <StaffAnalytics token={token} hallEnabled={hallEnabled} />;
}

function StaffPage({ component: Component }: Pick<Page, "component">) {
  return <Component token={useOutletContext<{ token: string }>().token} />;
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
        reviewsEnabled={layout.reviewsEnabled}
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
        reviewsEnabled={layout.reviewsEnabled}
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
        <main className="staff-workspace min-h-svh w-full min-w-0 bg-canvas px-6 py-16 text-main">
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
