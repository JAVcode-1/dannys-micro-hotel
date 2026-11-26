import { app as defaultApp } from "./app.js";
import { createHostedDevelopmentApp } from "./hosted-development.js";
import { runScheduledJobs } from "./notifications.js";
import { closeDatabase, databasePool } from "./database.js";
import { configuredMailAdapter } from "./mail.js";
import { closeStaffNavEvents } from "./staff-nav-events.js";

const app =
  process.env.NODE_ENV === "development"
    ? await createHostedDevelopmentApp()
    : defaultApp;
const mail =
  process.env.NODE_ENV === "development" ? configuredMailAdapter() : null;
if (process.env.NODE_ENV === "development" && !mail)
  console.warn(
    "Booking emails remain queued. Configure MAIL_PROVIDER=resend, RESEND_API_KEY, MAIL_FROM and MAIL_SITE_URL in backend/.env. Supabase Auth SMTP is configured separately.",
  );

const port = Number(process.env.PORT ?? 3001);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be an integer between 1 and 65535");
}
const server = app.listen(port, () => {
  console.log(`StayTrack API listening on port ${port}`);
});
let expirationRunning = false;
const expirationTimer =
  process.env.NODE_ENV === "development"
    ? setInterval(() => {
        if (expirationRunning) return;
        expirationRunning = true;
        void runScheduledJobs(databasePool(), mail ?? undefined)
          .then((result) => {
            if (result.failed)
              console.error(
                "Notification delivery failed; check the staff notification status.",
              );
          })
          .catch(() =>
            console.error(
              "Booking notification or expiration worker failed; staff review required.",
            ),
          )
          .finally(() => {
            expirationRunning = false;
          });
      }, 30000)
    : undefined;
function stop() {
  clearInterval(expirationTimer);
  server.close(() => void closeDatabase());
  closeStaffNavEvents(app);
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
