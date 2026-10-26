import { Effect } from "effect";
import { expect } from "vitest";
import { crossOriginPage, httpClient } from "#test/http-client/story.ts";
import { PaginationLinkError } from "./errors.ts";

httpClient.it("reads every item across three Link pages and stops at the last", [], function* ({ readPages, requests }) {
	expect(yield* readPages()).toEqual(["paper", "ink", "pens"]);
	expect(requests()).toEqual([
		{ method: "GET", path: "/pages/1?token=private" },
		{ method: "GET", path: "/pages/2?cursor=two" },
		{ method: "GET", path: "/pages/3" },
	]);
});

httpClient.it("taking the first page sends only one request", [], function* ({ readPages, requests }) {
	expect(requests()).toEqual([]);
	expect(yield* readPages(1)).toEqual(["paper"]);
	expect(requests()).toEqual([{ method: "GET", path: "/pages/1?token=private" }]);
});

httpClient.it(
	"refuses a next link on another origin before sending a request there",
	[crossOriginPage],
	function* ({ readPages, requests, foreignRequests, url }) {
		const error = yield* Effect.flip(readPages());
		expect(error).toEqual(new PaginationLinkError({ reason: "cross-origin", url: `${url()}/pages/1` }));
		expect(requests()).toEqual([{ method: "GET", path: "/pages/1?token=private" }]);
		expect(foreignRequests()).toEqual([]);
	},
);
