import type { AdminRoute } from "#page.ts";

function segments(path: string): readonly string[] {
	return path.replace(/\/$/u, "").split("/");
}

function isParameter(segment: string): boolean {
	return segment.startsWith("$") || /^\{-?\$[^}]*\}$/u.test(segment);
}

function matchesPath(declared: string, pathname: readonly string[]): boolean {
	const expected = segments(declared);
	return (
		expected.length === pathname.length
		&& expected.every((segment, index) => (isParameter(segment) ? pathname[index] !== "" : segment === pathname[index]))
	);
}

// React's matchAdminPage applies these same rules in the browser without depending on admin, and matchAdminRoute.unit.test.ts runs one table through both so they stay in step.
export function matchAdminRoute(routes: readonly AdminRoute[], pathname: string): AdminRoute | undefined {
	const actual = segments(pathname);
	if (actual.join("/") === "/admin") {
		return routes[0];
	}
	return (
		routes.find((route) => matchesPath(route.path, actual)) ?? routes.find((route) => route.detail !== undefined && matchesPath(route.detail, actual))
	);
}
