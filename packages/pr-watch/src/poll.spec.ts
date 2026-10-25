import { Effect } from "effect";
import { expect } from "vitest";
import { hasPull, historyIs, queuedPulls, quotaRemaining, watchesFleet, watchesPulls } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it("ETag 304 reuses snapshots without events or spending quota", [quotaRemaining(2501)], function* (h) {
	yield* h.poll;
	expect(yield* h.delay()).toBe(h.options.interval);
	yield* h.poll;
	expect(yield* h.delay()).toBe(h.options.interval);
	const last = h.requests.slice(-4);
	expect(last.map((request) => request.path)).toEqual([
		"/repos/acme/project/git/matching-refs/heads/gh-readonly-queue/",
		"/repos/acme/project/pulls/1",
		"/repos/acme/project/commits/sha1/check-runs?per_page=100&filter=latest",
		"/repos/acme/project/commits/sha1/status",
	]);
	expect(last.map((request) => request.status)).toEqual([304, 304, 304, 304]);
	expect(last.every((request) => request.etag !== undefined)).toBe(true);
	expect(last.every((request) => request.authorization === "Bearer test-token")).toBe(true);
	expect(h.lines).toEqual([]);
});
watch.it("restart observes downtime differences and does not repeat acknowledged events", [], function* (h) {
	yield* h.poll;
	h.merged(1);
	yield* h.restart;
	yield* h.restart;
	expect(h.eventNames()).toEqual(["merged"]);
	expect((yield* h.stored()).prs["1"].merged).toBe(true);
});
watch.it("fleet discovers later PRs, follows closed PRs and paginates discovery", [watchesFleet()], function* (h) {
	yield* h.poll;
	h.pullIs(2);
	h.pages("/pulls?state=open&per_page=100", [{ number: 1 }], "/pulls?page=2", { body: [{ number: 2 }] });
	yield* h.poll;
	h.pullIs(2, { state: "closed" });
	h.openPulls(1);
	yield* h.poll;
	expect(h.events()).toEqual([{ branch: "feature-2", event: "closed", number: 2, title: "Change 2" }]);
});
watch.it("multiple explicit PRs share one queue request per cycle", [watchesPulls(1, 2), hasPull(2)], function* (h) {
	yield* h.poll;
	h.pullIs(1, { state: "closed" });
	h.merged(2);
	yield* h.poll;
	expect(h.eventNames()).toEqual(["closed", "merged"]);
	expect(h.requests.filter((request) => request.path.includes("matching-refs"))).toMatchObject([
		{ method: "GET", path: "/repos/acme/project/git/matching-refs/heads/gh-readonly-queue/", status: 200 },
		{ method: "GET", path: "/repos/acme/project/git/matching-refs/heads/gh-readonly-queue/", status: 304 },
	]);
});
for (const status of [500, 403, 429]) {
	watch.it(`HTTP ${status} produces no inferred events`, [], function* (h) {
		yield* h.poll;
		h.pullIs(1, { mergeable: false, "mergeable_state": "dirty" });
		h.reply("/commits/sha1/status", { body: {}, headers: { "retry-after": "2" }, status });
		expect((yield* Effect.result(h.poll))._tag).toBe("Failure");
		expect((yield* h.saved()).prs["1"]?.dirty).toBe(false);
		expect(h.lines).toEqual([]);
		expect(h.diagnostics).toEqual([status === 500 ? "GitHub request failed" : "GitHub quota cooldown"]);
	});
}
watch.it("a failed queue request does not imply dequeue", [queuedPulls(1)], function* (h) {
	yield* h.poll;
	h.reply("/git/matching-refs/heads/gh-readonly-queue/", { body: [], status: 500 });
	yield* Effect.result(h.poll);
	expect(h.lines).toEqual([]);
	h.queueHas();
	h.pullIs(1, { "auto_merge": null });
	yield* h.poll;
	expect(h.eventNames()).toEqual(["dequeued", "auto-merge-off"]);
});
watch.it("malformed responses and unknown mergeability retain the old state", [], function* (h) {
	yield* h.poll;
	h.reply("/pulls/1", { body: {} });
	yield* Effect.result(h.poll);
	h.pullIs(1, { mergeable: null, "mergeable_state": "unknown" });
	yield* Effect.result(h.poll);
	expect(h.lines).toEqual([]);
	expect(h.diagnostics).toEqual(["Invalid GitHub response"]);
});
watch.it("invalid state and a different repository fail without overwriting it", [historyIs("broken")], function* (h) {
	expect((yield* Effect.result(h.poll))._tag).toBe("Failure");
	yield* h.stateTextIs(JSON.stringify({ prs: {}, repository: "other/project", version: 1 }));
	expect((yield* Effect.result(h.poll))._tag).toBe("Failure");
	expect(h.requests).toEqual([]);
});
