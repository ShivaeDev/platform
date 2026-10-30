import { expect } from "vitest";
import { httpClient, pageOneLinksToAnotherOrigin, threeLinkedPages } from "#test/http-client/story.ts";

httpClient.it("reading every page returns paper, ink and pens", [threeLinkedPages], function* ({ readEveryPage }) {
	expect(yield* readEveryPage()).toEqual(["paper", "ink", "pens"]);
});

httpClient.it(
	"reading every page follows each next link, sending page 2 with its own cursor instead of page 1's token and stopping after page 3",
	[threeLinkedPages],
	function* ({ readEveryPage, requests }) {
		yield* readEveryPage();

		expect(yield* requests()).toEqual(["GET /pages/1?token=private", "GET /pages/2?cursor=two", "GET /pages/3"]);
	},
);

httpClient.it("taking only the first page sends only page 1's request", [threeLinkedPages], function* ({ readFirstPage, requests }) {
	expect(yield* requests()).toEqual([]);

	yield* readFirstPage();

	expect(yield* requests()).toEqual(["GET /pages/1?token=private"]);
});

httpClient.it(
	"a next link to another origin fails as a cross-origin link on page 1's URL without its query",
	[pageOneLinksToAnotherOrigin],
	function* ({ readEveryPage }) {
		expect(yield* readEveryPage()).toBe("cross-origin next link on /pages/1");
	},
);

httpClient.it("a next link to another origin is never requested", [pageOneLinksToAnotherOrigin], function* ({ otherOriginRequests, readEveryPage }) {
	yield* readEveryPage();

	expect(yield* otherOriginRequests()).toEqual([]);
});
