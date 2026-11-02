import * as Duration from "effect/Duration";
import * as Cookies from "effect/http/Cookies";

interface StoredCookie {
	readonly cookie: Cookies.Cookie;
	readonly domain: string;
	readonly expires: number;
	readonly hostOnly: boolean;
	readonly path: string;
}

function matchesDomain(host: string, domain: string, hostOnly: boolean) {
	return host === domain || (!hostOnly && host.endsWith(`.${domain}`));
}

function scopeCookie(cookie: Cookies.Cookie, url: URL, now: number): StoredCookie | undefined {
	const options = cookie.options;
	const domain = options?.domain?.toLowerCase() ?? url.hostname;
	const hostOnly = options?.domain === undefined;
	if (!matchesDomain(url.hostname, domain, hostOnly) || (options?.secure && url.protocol !== "https:")) {
		return undefined;
	}
	const defaultPath = url.pathname.slice(0, url.pathname.lastIndexOf("/")) || "/";
	const path = options?.path?.startsWith("/") ? options.path : defaultPath;
	const expires = options?.maxAge === undefined ? (options?.expires?.getTime() ?? Number.POSITIVE_INFINITY) : now + Duration.toMillis(options.maxAge);
	return { cookie, domain, expires, hostOnly, path };
}

export function visitorCookies() {
	const stored = new Map<string, StoredCookie>();
	return {
		header(url: URL, now: number) {
			return [...stored.values()]
				.filter(
					({ cookie, domain, expires, hostOnly, path }) =>
						expires > now
						&& matchesDomain(url.hostname, domain, hostOnly)
						&& (!cookie.options?.secure || url.protocol === "https:")
						&& (url.pathname === path || url.pathname.startsWith(path.endsWith("/") ? path : `${path}/`)),
				)
				.sort((left, right) => right.path.length - left.path.length)
				.map(({ cookie }) => `${cookie.name}=${cookie.valueEncoded}`)
				.join("; ");
		},
		keep(headers: readonly string[], url: URL, now: number) {
			for (const header of headers) {
				for (const cookie of Object.values(Cookies.fromSetCookie(header).cookies)) {
					const scoped = scopeCookie(cookie, url, now);
					if (scoped === undefined) {
						continue;
					}
					const key = JSON.stringify([scoped.domain, scoped.path, cookie.name]);
					if (scoped.expires <= now) {
						stored.delete(key);
					} else {
						stored.set(key, scoped);
					}
				}
			}
		},
	};
}
