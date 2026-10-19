import type { Navigation } from "#browser/Navigation.ts";
import { fileUrl } from "#files/url.ts";

export type DocumentTarget = { readonly item: string } | { readonly file: string };

export function documentRoute(pathname: string, home: Navigation["home"]): boolean {
	if (
		home
		&& (pathname === "/"
			|| pathname === fileUrl(home.file)
			|| (home.identity !== undefined && pathname.replace(/\/$/u, "") === `/_board/item/${encodeURIComponent(home.identity)}`))
	) {
		return false;
	}
	return pathname === "/" || documentTarget(pathname) !== undefined;
}

// A link that can't be decoded names no document, matching the server's 404 for invalid percent-encoding.
export function documentTarget(pathname: string): DocumentTarget | undefined {
	const id = /^\/_board\/item\/(?<id>[^/]+)\/?$/u.exec(pathname)?.groups?.id;
	if (id === undefined && !/\.md$/iu.test(pathname)) {
		return undefined;
	}
	try {
		return id === undefined ? { file: decodeURIComponent(pathname.slice(1)) } : { item: decodeURIComponent(id) };
	} catch {
		return undefined;
	}
}

export function documentTitle(url: string) {
	const target = documentTarget(new URL(url, "http://127.0.0.1").pathname);
	return target && ("item" in target ? target.item : target.file);
}
