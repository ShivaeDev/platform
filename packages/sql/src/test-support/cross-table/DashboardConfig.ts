import { Context } from "effect";

export class DashboardConfig extends Context.Service<DashboardConfig, { readonly pullRequests: string; readonly reports: string }>()(
	"@shivaedev/sql/dashboard/Tables",
) {}
