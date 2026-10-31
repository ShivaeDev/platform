import type { Permission } from "@shivaedev/access/permission.ts";
import { matchAdminRoute } from "#adapters/matchAdminRoute.ts";
import type { AdminRoute } from "#page.ts";

interface GuardContext {
	readonly location: { readonly href: string; readonly pathname: string; readonly state?: object | undefined };
	readonly matches: readonly { readonly staticData: { readonly permission?: Permission; readonly signedIn?: boolean } }[];
}

export function adminPermissionGuard(pages: readonly { readonly route: AdminRoute }[], guard: (context: GuardContext) => void) {
	const routes = pages.map((page) => page.route);
	return (context: GuardContext): void => {
		const matched = matchAdminRoute(routes, context.location.pathname);
		guard({ ...context, matches: [...context.matches, { staticData: matched === undefined ? {} : { permission: matched.permission } }] });
	};
}
