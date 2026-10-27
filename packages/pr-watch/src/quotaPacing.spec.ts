import { expect } from "vitest";
import { quotaHeaders } from "#test/fixtures.ts";
import { watch } from "#test/watch.ts";

watch.it(
	"healthy budgets poll normally after a retained low search observation expires",
	[],
	function* (h) {
		h.reply("/git/matching-refs/heads/gh-readonly-queue/", { body: [], headers: quotaHeaders("search", 12, 30, 30_000) });
		h.reply("/commits/sha1/check-runs?per_page=100&filter=latest", {
			body: { "check_runs": [] },
			headers: quotaHeaders("graphql", 4970, 5000, 3_600_000),
		});
		h.reply("/commits/sha1/status", { body: { state: "success" }, headers: quotaHeaders("core", 4750, 5000, 3_600_000) });
		yield* h.poll;
		h.queueHas();
		yield* h.advance(30_000);
		yield* h.start("--interval", "60", "--events", "merged");
		yield* h.waitForPollWait();
		expect(h.events()).toEqual([]);
		const requests = h.requests.length;
		yield* h.advance(60_000);
		yield* h.waitForPollWait();
		expect(h.requests.slice(requests).map((request) => request.path)).toContain("/repos/acme/project/pulls/1");
		expect(h.events()).toEqual([]);
		yield* h.interrupt();
	},
	{ clock: "test" },
);

watch.it(
	"a half-used search budget that resets within the interval keeps normal polling",
	[],
	function* (h) {
		h.reply("/commits/sha1/status", { body: { state: "success" }, headers: quotaHeaders("search", 14, 30, 30_000) });
		yield* h.start("--interval", "60", "--events", "merged");
		yield* h.waitForPollWait();
		expect(h.events()).toEqual([]);
		const requests = h.requests.length;
		yield* h.advance(60_000);
		yield* h.waitForPollWait();
		expect(h.requests.slice(requests).map((request) => request.path)).toContain("/repos/acme/project/pulls/1");
		expect(h.events()).toEqual([]);
		yield* h.interrupt();
	},
	{ clock: "test" },
);

watch.it(
	"a low core budget paces polling and names its remaining count, limit and reset",
	[],
	function* (h) {
		h.reply("/commits/sha1/status", { body: { state: "success" }, headers: quotaHeaders("core", 9, 5000, 3_600_000) });
		yield* h.start("--interval", "60", "--events", "merged");
		yield* h.waitForPollWait();
		expect(h.events()).toEqual([
			expect.objectContaining({
				event: "cooldown",
				message: "GitHub quota pacing (core: 9/5000 remaining; reset 1970-01-01T01:00:00.000Z)",
				nextPollAt: new Date(2_000_000).toISOString(),
			}),
		]);
		const requests = [...h.requests];
		yield* h.advance(60_000);
		expect(h.requests).toEqual(requests);
		yield* h.interrupt();
	},
	{ clock: "test" },
);
