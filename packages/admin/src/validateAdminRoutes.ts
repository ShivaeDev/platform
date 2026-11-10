import { Effect } from "effect";
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

export const validateAdminRoutes = Effect.fnUntraced(function* (routes: readonly AdminRoute[]) {
	const paths: string[] = [];
	for (const route of routes) {
		const page = route.path.replace(/\/$/u, "");
		const detail = route.detail?.replace(/\/$/u, "");
		if (detail !== undefined && !detail.startsWith(`${page}/`)) {
			yield* Effect.die(new Error(`Admin detail path ${route.detail} must be under page path ${route.path}`));
		}
		for (const path of detail === undefined ? [page] : [page, detail]) {
			const normalized = path.replace(/\$[^/]+/gu, "$");
			if (paths.includes(normalized)) {
				yield* Effect.die(new Error(`Duplicate admin path: ${normalized}`));
			}
			const existing = paths.find((candidate) => overlaps(candidate, normalized));
			if (existing !== undefined) {
				yield* Effect.die(new Error(`Overlapping admin paths: ${existing} and ${normalized}`));
			}
			paths.push(normalized);
		}
	}
});
