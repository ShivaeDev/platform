import type { Navigation } from "#browser/Navigation.ts";
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
	return pathname === "/" || /\.md$/iu.test(pathname) || itemRouteId(pathname) !== undefined;
}

export function itemRouteId(pathname: string) {
	const id = /^\/_board\/item\/(?<id>[^/]+)\/?$/u.exec(pathname)?.groups?.id;
	return id === undefined ? undefined : decoded(id);
}

export function decodedPath(pathname: string) {
	return decoded(pathname.slice(1));
}

export function documentTitle(url: string) {
	const pathname = new URL(url, "http://127.0.0.1").pathname;
	return (itemRouteId(pathname) ?? decodedPath(pathname)) || undefined;
}

function decoded(value: string) {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}
