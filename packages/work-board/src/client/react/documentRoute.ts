import type { Navigation } from "#browser/navigation/schema.ts";
import { fileUrl } from "#files/url.ts";
export function documentRoute(pathname: string, home: Navigation["home"]): boolean {
	if (
		home
		&& (pathname === "/"
			|| pathname === fileUrl(home.file)
			|| (home.identity !== undefined && pathname.replace(/\/$/u, "") === `/_board/item/${encodeURIComponent(home.identity)}`))
	) {
		return false;
	}
	return pathname === "/" || /\.md$/iu.test(pathname) || /^\/_board\/item\/[^/]+\/?$/u.test(pathname);
}
