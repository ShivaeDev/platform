import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { paginationRedirects } from "#test/http-client/paginationRedirects.ts";

const fetchRedirects = paginationRedirects("fetch");
const nodeRedirects = paginationRedirects("node");

for (const redirects of [fetchRedirects, nodeRedirects]) {
	for (const path of ["/redirect", "/first"] as const) {
		redirects.it(
			`a foreign redirect from ${path} stops pagination before sending the custom API key to that origin`,
			[],
			function* ({ foreignRequests, readPages, remoteRequests }) {
				const result = yield* readPages(path);

				expect(result).toBe("redirect refused");
				yield* outcomes([
					[
						"requests on the original origin",
						() => remoteRequests(),
						(path === "/first" ? ["/first", "/redirect"] : ["/redirect"]).map((visited) => ({ path: visited, secret: "private-key" })),
					],
					["requests on the foreign origin", () => foreignRequests(), []],
				]);
			},
		);
	}
}

fetchRedirects.it("a same-origin redirect also stops fetch pagination", [], function* ({ readPages, remoteRequests }) {
	const result = yield* readPages("/local-redirect");

	expect(result).toBe("redirect refused");
	expect(yield* remoteRequests()).toEqual([{ path: "/local-redirect", secret: "private-key" }]);
});

fetchRedirects.it("pagination preserves default fetch headers", [], function* ({ defaultHeaders, readPages }) {
	yield* readPages("/last");

	expect(yield* defaultHeaders()).toEqual(["kept"]);
});
