import type { AdminRoute } from "#page.ts";

function overlaps(left: string, right: string): boolean {
	const expected = left.split("/");
	const actual = right.split("/");
	return (
		expected.length === actual.length
		&& expected.every(
			(segment, index) => segment === actual[index] || (segment === "$" && actual[index] !== "") || (actual[index] === "$" && segment !== ""),
		)
	);
}

function pathsOf(route: AdminRoute): readonly string[] {
	const page = route.path.replace(/\/$/u, "");
	const detail = route.detail?.replace(/\/$/u, "");
	if (detail !== undefined && !detail.startsWith(`${page}/`)) {
		throw new Error(`Admin detail path ${route.detail} must be under page path ${route.path}`);
	}
	return detail === undefined ? [page] : [page, detail];
}

export function validateAdminRoutes(routes: readonly AdminRoute[]): void {
	const paths: string[] = [];
	for (const path of routes.flatMap(pathsOf)) {
		const normalized = path.replace(/\$[^/]+/gu, "$");
		if (paths.includes(normalized)) {
			throw new Error(`Duplicate admin path: ${normalized}`);
		}
		const existing = paths.find((candidate) => overlaps(candidate, normalized));
		if (existing !== undefined) {
			throw new Error(`Overlapping admin paths: ${existing} and ${normalized}`);
		}
		paths.push(normalized);
	}
}
