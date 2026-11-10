import type { AdminRoute } from "#page.ts";

export function matchAdminRoute(routes: readonly AdminRoute[], pathname: string): AdminRoute | undefined {
	const path = pathname.replace(/\/$/u, "");
	if (path === "/admin") {
		return routes[0];
	}
	return (
		routes.find((route) => route.path.replace(/\/$/u, "") === path)
		?? routes.find((route) => {
			if (route.detail === undefined) {
				return false;
			}
			const expected = route.detail.replace(/\/$/u, "").split("/");
			const actual = path.split("/");
			return (
				expected.length === actual.length
				&& expected.every((segment, index) => (segment.startsWith("$") ? actual[index] !== "" : segment === actual[index]))
			);
		})
	);
}
