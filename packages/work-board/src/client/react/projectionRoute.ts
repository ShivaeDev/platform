import type { Navigation } from "#browser/Navigation.ts";
import { fileUrl } from "#files/url.ts";
export function projectionRoute(pathname: string, home: Navigation["home"]) {
	if (pathname === "/_board/work") {
		return "work";
	}
	if (pathname === "/_board/overview") {
		return "overview";
	}
	if (pathname === "/_board/inbox") {
		return "inbox";
	}
	if (
		home
		&& (pathname === "/"
			|| pathname === fileUrl(home.file)
			|| (home.identity && pathname.replace(/\/$/u, "") === `/_board/item/${encodeURIComponent(home.identity)}`))
	) {
		return "board";
	}
	return undefined;
}
export type ProjectionRoute = NonNullable<ReturnType<typeof projectionRoute>>;
