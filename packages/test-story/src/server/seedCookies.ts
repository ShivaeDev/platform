import { Effect } from "effect";
import { BrowserWindow, CookieSameSiteEnum } from "happy-dom";
import WindowBrowserContext from "happy-dom/lib/window/WindowBrowserContext.js";

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

const sameSites = { Lax: CookieSameSiteEnum.lax, None: CookieSameSiteEnum.none, Strict: CookieSameSiteEnum.strict };

export const seedCookies = Effect.fnUntraced(function* (cookies: readonly DomCookie[]) {
	if (!(window instanceof BrowserWindow)) {
		return yield* Effect.die("Cookie preconditions need a happy-dom window.\nhelp: Use test-story's DOM environment before seeding cookies.");
	}
	const context = new WindowBrowserContext(window).getBrowserContext();
	if (context === null) {
		return yield* Effect.die("Cannot seed cookies after the document has closed.");
	}
	context.cookieContainer.addCookies(
		cookies.map((cookie) => ({
			key: cookie.name,
			"originURL": new URL(window.location.href),
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
