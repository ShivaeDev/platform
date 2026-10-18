import { Effect } from "effect";
import { expect } from "vitest";
import { hasMergedPull, hasPull, incompleteObservation, queuedPulls, watchesFleet } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it("fleet reports a downtime merge once across clean restarts", [watchesFleet()], function* (h) {
	yield* h.poll;
	h.merged(1);
	h.openPulls();
	yield* h.restart;
	const count = h.requests.length;
	yield* h.restart;
	expect(h.events()).toEqual([{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" }]);
	expect(h.requests.slice(count).map((request) => request.path)).toEqual(["/repos/acme/project/pulls?state=open&per_page=100"]);
});
watch.it("a PR can enter the queue and merge entirely between polls", [watchesFleet()], function* (h) {
	yield* h.poll;
	h.queueHas(1);
	h.pullIs(1, { "auto_merge": null });
	h.queueHas();
	h.pullIs(1, { "auto_merge": null, merged: true, state: "closed" });
	h.openPulls();
	yield* h.poll;
	yield* h.restart;
	expect(h.eventNames()).toEqual(["merged"]);
	expect(h.requests.some((request) => request.path === "/graphql")).toBe(false);
});
for (const failure of ["mergeability", "checks", "detail", "queue"]) {
	watch.it(
		`fleet remembers an open PR when its first ${failure} observation fails`,
		[watchesFleet(), queuedPulls(1), incompleteObservation(failure)],
		function* (h) {
			expect((yield* Effect.result(h.poll))._tag).toBe("Failure");
			expect(h.events()).toEqual([]);
			expect(yield* h.saved()).toMatchObject({ openNumbers: [1], prs: {} });
			h.pullIs(1, { "auto_merge": null, merged: true, state: "closed" });
			h.openPulls();
			h.queueHas();
			expect((yield* h.restart).openNumbers).toEqual([]);
			yield* h.restart;
			expect(h.eventNames()).toEqual(["merged"]);
		},
	);
}
for (const merged of [false, true]) {
	watch.it(
		`discovery-only tracking reports a later terminal merged=${merged} observation once`,
		[watchesFleet(), hasPull(1, { mergeable: null, "mergeable_state": "unknown" })],
		function* (h) {
			yield* Effect.result(h.poll);
			h.openPulls();
			h.pullIs(1, { merged, state: "closed" });
			yield* h.poll;
			yield* h.restart;
			expect(h.eventNames()).toEqual([merged ? "merged" : "closed"]);
		},
	);
}
watch.it(
	"a discovered PR still establishes its first complete open baseline",
	[watchesFleet(), queuedPulls(1), hasPull(1, { mergeable: null, "mergeable_state": "unknown" })],
	function* (h) {
		yield* Effect.result(h.poll);
		h.pullIs(1, { mergeable: false, "mergeable_state": "dirty" });
		yield* h.restart;
		expect(h.eventNames()).toEqual(["conflict", "stuck"]);
		h.merged(1);
		h.openPulls();
		h.queueHas();
		yield* h.restart;
		yield* h.restart;
		expect(h.eventNames()).toEqual(["conflict", "stuck", "merged"]);
	},
);
watch.it("fleet reports a PR that merges between discovery and its first detail response", [watchesFleet(), hasMergedPull(1)], function* (h) {
	yield* h.poll;
	yield* h.restart;
	expect(h.eventNames()).toEqual(["merged"]);
});
