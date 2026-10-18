import { Effect } from "effect";
import { expect } from "vitest";
import { documentApp } from "#test/documentApp.ts";

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
	expect(window.fetch).not.toBe(globalThis.fetch);
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
