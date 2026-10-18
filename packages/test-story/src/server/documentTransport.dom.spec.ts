import { Effect } from "effect";
import { expect } from "vitest";
import { documentApp } from "#test/documentApp.ts";

documentApp.it(
	"sends a seeded HttpOnly session and cookieStore cookies to its real host",
	[],
	function* ({ seedSession, storeCookie, hostRequest, cookies }) {
		yield* seedSession();
		yield* storeCookie();
		expect(cookies()).toContain("theme=dark");
		expect(cookies()).toContain("preference=compact");
		expect(cookies()).not.toContain("session=");
		expect(yield* hostRequest()).toMatchObject({ cookie: "session=minted-session; theme=dark; preference=compact", method: "GET", path: "/echo" });
	},
);

for (const [status, method, body] of [
	[302, "GET", ""],
	[307, "POST", "story-body"],
] as const) {
	documentApp.it(`a ${status} redirect sends ${method} with document cookies`, [], function* ({ post, cookies }) {
		const response = yield* post(status, "story-body");
		expect(response.redirected).toBe(true);
		expect(response.url).toBe("https://provider.test/echo");
		expect(response.headers.get("set-cookie")).toBeNull();
		expect(yield* Effect.promise(() => response.json())).toEqual({
			body,
			cookie: "first=one; second=two",
			header: "retained",
			method,
			path: "/echo",
		});
		expect(cookies()).not.toContain("first=");
	});
}

documentApp.it("loads the routed page and leaves its response readable", [], function* ({ loadPage, heading, location }) {
	const response = yield* loadPage();
	expect(heading()).toBe("Routed document");
	expect(location()).toBe("https://provider.test/page");
	expect(yield* Effect.promise(() => response.text())).toContain("Routed document");
});

documentApp.it("routes XMLHttpRequest through the document transport", [], function* ({ xhr }) {
	const text = yield* xhr();
	expect(JSON.parse(text)).toMatchObject({ method: "GET", path: "/echo" });
});

documentApp.it("refuses synchronous document requests before they reach the network", [], ({ syncRequest }) => {
	expect(syncRequest()).toContain("test-story refuses synchronous document requests to provider.test");
});

documentApp.it("releases its routed HTTP host when the story finishes", [], function* ({ hostUrl, loadPage }, context) {
	const url = hostUrl();
	const response = yield* loadPage();
	expect(response.status).toBe(200);
	context.onTestFinished(async () => {
		await expect(globalThis.fetch(`${url}/page`)).rejects.toThrow();
	});
});
