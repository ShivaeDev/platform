---
"@shivaedev/create-app": minor
"@shivaedev/quality": minor
---

### Added

- Generated apps include app-owned admin navigation, Jobs health, counts, failed and dead-lettered lists, job detail, and an example note-statistics page on the existing protected RPC transport. Jobs views accept retry actions from explicitly retry-enabled registrations and retain the default read-only registration.

### Breaking

- `@shivaedev/create-app`'s starter no longer serves the pg-boss dashboard at `/admin/jobs`; the app-owned admin Jobs views replace it. Existing apps must remove `readOnlyDashboard.ts`, `readOnlyDashboardWorker.ts`, `checkDashboardVersion.ts` and `jobDashboard.ts`, remove the `@pg-boss/dashboard` dependency and catalog pin, and register the admin pages and their handlers on the existing `/rpc` host. Keep admin account provisioning through `admin:create`, `admin.ts` and `createAdmin.ts`.
- `@shivaedev/quality`'s `appViteConfig` leaves `/admin/jobs` on the client router. Apps that still host a server dashboard at that path must add their own Vite `server.proxy` entry for `/admin/jobs` targeting the app host.
