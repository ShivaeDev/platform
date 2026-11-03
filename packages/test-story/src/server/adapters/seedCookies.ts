import * as Effect from "effect/Effect";
import type { BrowserWindow as DomWindow } from "happy-dom";

export interface DomCookie {
	readonly domain?: string;
	readonly expires?: number;
	readonly httpOnly?: boolean;
	readonly name: string;
	readonly path?: string;
	readonly sameSite?: "Lax" | "Strict" | "None";
	readonly secure?: boolean;
	readonly value: string;
}

export const seedCookies = Effect.fnUntraced(function* (cookies: readonly DomCookie[], target: Window | DomWindow = window) {
	const { BrowserWindow, CookieSameSiteEnum } = yield* Effect.promise(() => import("happy-dom"));
	const { default: WindowBrowserContext } = yield* Effect.promise(() => import("happy-dom/lib/window/WindowBrowserContext.js"));
	const sameSites = { Lax: CookieSameSiteEnum.lax, None: CookieSameSiteEnum.none, Strict: CookieSameSiteEnum.strict };
	if (!(target instanceof BrowserWindow)) {
		return yield* Effect.die("Cookie preconditions need a happy-dom window.\nhelp: Use test-story's DOM environment before seeding cookies.");
	}
	const context = new WindowBrowserContext(target).getBrowserContext();
	if (context === null) {
		return yield* Effect.die("Cannot seed cookies after the document has closed.");
	}
	context.cookieContainer.addCookies(
		cookies.map((cookie) => ({
			key: cookie.name,
			"originURL": new URL(target.location.href),
			value: cookie.value,
			...(cookie.domain === undefined ? {} : { domain: cookie.domain }),
			...(cookie.path === undefined ? {} : { path: cookie.path }),
			...(cookie.httpOnly === undefined ? {} : { httpOnly: cookie.httpOnly }),
			...(cookie.secure === undefined ? {} : { secure: cookie.secure }),
			...(cookie.sameSite === undefined ? {} : { sameSite: sameSites[cookie.sameSite] }),
			...(cookie.expires === undefined ? {} : { expires: new Date(cookie.expires * 1000) }),
		})),
	);
});
