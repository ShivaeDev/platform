import { contract } from "@shivaedev/contract/contract.ts";
import { type AdminRoute, adminPage } from "#page.ts";
import { JobsPermission } from "#permissions.ts";
import { Profile } from "./pages.ts";

export type RoutePaths = Pick<AdminRoute, "path" | "detail">;

export function routePages(routes: readonly RoutePaths[]) {
	return routes.map((route, index) =>
		adminPage({
			contract: contract(`admin.routes.${index}`, { queries: [Profile] }),
			id: `page-${index}`,
			permission: JobsPermission,
			route: { ...route, title: `Page ${index}` },
		}),
	);
}
