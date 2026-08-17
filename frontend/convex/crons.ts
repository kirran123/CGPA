import { cronJobs } from "convex/server";
import { api } from "./_generated/api";

const crons = cronJobs();

// The bearer token is read from a Convex environment variable (set in the
// Convex dashboard → Settings → Environment Variables as ERP_BEARER_TOKEN).
// The hardcoded value below is a fallback for local development only.
const ERP_TOKEN =
  process.env.ERP_BEARER_TOKEN ??
  "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJzZXJ2aWNlOnByaW1hcnktYXBpLWNvbnN1bWVyIiwic3ZjIjp0cnVlLCJqdGkiOiIzZjFjOWE3ZTViMmQ0OGM2IiwiaXNfYWRtaW4iOmZhbHNlLCJpYXQiOjE3ODY5NDg5NTEsImV4cCI6MjEwMjMwODk1MX0.06bbln7QeWOOHB9ch66JPYdiKEJyX0_AOF_lDrrIWDo";

// Run a full ERP sync every day at 02:00 UTC (07:30 IST).
// All mutations use upsert logic — no duplicate records are ever created.
crons.daily(
  "erp-live-sync",
  { hourUTC: 2, minuteUTC: 0 },
  api.erpSync.syncData,
  {
    token: ERP_TOKEN,
    syncDepartments: true,
    syncRegulations: true,
    syncSubjects: true,
    syncStudents: true,
  }
);

export default crons;
