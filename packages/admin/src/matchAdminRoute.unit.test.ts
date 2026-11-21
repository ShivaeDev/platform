import { describe, expect, it } from "vitest";
import { permission } from "@shivaedev/access/permission.ts";
import { matchAdminPage } from "@shivaedev/react/client/matchAdminPage.ts";
import { matchAdminRoute } from "#matchAdminRoute.ts";
import type { AdminRoute } from "#page.ts";

const routes: readonly AdminRoute[] = [
	{ detail: "/admin/reports/$id", path: "/admin/reports", permission: permission("reports.read"), title: "Reports" },
	{ detail: "/admin/invoices/{$invoiceId}", path: "/admin/invoices", permission: permission("invoices.read"), title: "Invoices" },
	{ path: "/admin/teams/$team/members", permission: permission("teams.read"), title: "Team members" },
	{ path: "/admin/logs/{-$day}", permission: permission("logs.read"), title: "Logs" },
];

const cases = [
	["the bare admin index", "/admin", "Reports"],
	["a literal under a detail path", "/admin/reports/new", "Reports"],
	["a brace detail", "/admin/invoices/42", "Invoices"],
	["a parameter in a page's path", "/admin/teams/blue/members", "Team members"],
	["a trailing slash", "/admin/reports/", "Reports"],
	["an optional segment absent from the URL", "/admin/logs", "none"],
	["an optional segment present in the URL", "/admin/logs/monday", "Logs"],
	["a nested child of a detail", "/admin/reports/7/history", "none"],
	["an unknown path", "/admin/unknown", "none"],
] as const;

describe("admin's matcher and react's root guard", () => {
	for (const [name, pathname, page] of cases) {
		it(`pick the same page for ${name}`, () => {
			const pages = routes.map((route) => ({ route }));

			expect({
				admin: matchAdminRoute(routes, pathname)?.title ?? "none",
				react: matchAdminPage(pages, pathname)?.route.title ?? "none",
			}).toEqual({ admin: page, react: page });
		});
	}
});
