import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "#outcomes.ts";
import { documentApp } from "#test/documentApp.ts";

documentApp.it("keeps the seeded HttpOnly session out of document.cookie", [], function* ({ seedsSession, storesPreference, documentCookies }) {
	yield* seedsSession();

	yield* storesPreference();

	expect(yield* documentCookies()).toBe("theme=dark; preference=compact");
});

documentApp.it(
	"sends the seeded session and the stored preference to the real host",
	[],
	function* ({ seedsSession, storesPreference, hostSawCookies }) {
		yield* seedsSession();
		yield* storesPreference();

		expect(yield* hostSawCookies()).toBe("session=minted-session; theme=dark; preference=compact");
	},
);

for (const [status, method, body] of [
	[HttpStatus.fromLiteral("Found"), "GET", ""],
	[HttpStatus.fromLiteral("TemporaryRedirect"), "POST", "story-body"],
] as const) {
	documentApp.it(
		`follows a ${status} redirect with ${method} and the redirect's cookies while hiding them from the page`,
		[],
		function* ({ postsThroughRedirect, finalUrl, echo, exposedSetCookie, documentCookies }) {
			yield* postsThroughRedirect(status, "story-body");

			yield* outcomes({
				"the echoed request": [echo(), { body, cookie: "first=one; second=two", header: "retained", method, path: "/echo" }],
				"the exposed set-cookie header": [exposedSetCookie(), "none"],
				"the final address": [finalUrl(), "https://provider.test/echo"],
				"the page's cookies": [documentCookies(), ""],
			});
		},
	);
}

documentApp.it("navigates to the routed page and leaves its response readable", [], function* ({ loadsPage, heading, location, pageBody }) {
	expect(yield* heading()).toBe("no heading");

	yield* loadsPage();

	yield* outcomes({
		"the heading": [heading(), "Routed document"],
		"the location": [location(), "https://provider.test/page"],
		"the response body": [pageBody(), "<h1>Routed document</h1>"],
	});
});

documentApp.it("routes XMLHttpRequest through the document transport", [], function* ({ xhrRequest }) {
	expect(yield* xhrRequest()).toBe("GET /echo");
});

documentApp.it("refuses synchronous document requests before they reach the network", [], function* ({ requestsSynchronously }) {
	expect(yield* requestsSynchronously()).toBe("test-story refuses synchronous document requests to provider.test; use fetch instead");
});
