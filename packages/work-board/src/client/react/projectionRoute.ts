import type { Navigation } from "#browser/Navigation.ts";
import { fileUrl } from "#files/url.ts";
export function projectionRoute(pathname: string, home: Navigation["home"]) {
	if (pathname === "/") {
		return "today";
	}
	if (pathname === "/_board/work") {
		return "work";
	}
	if (
		home
		&& (pathname === fileUrl(home.file) || (home.identity && pathname.replace(/\/$/u, "") === `/_board/item/${encodeURIComponent(home.identity)}`))
	) {
		return "board";
	}
	return undefined;
}
export type ProjectionRoute = NonNullable<ReturnType<typeof projectionRoute>>;
