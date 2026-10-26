import { expect } from "vitest";
import { hasPull, queuedPulls, watchesFleet, watchesPulls } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

for (const state of ["open", "closed"]) {
	for (const autoMerge of [null, { "merge_method": "squash" }]) {
		watch.it(`a queue merge emits only merged with state=${state} and auto-merge=${autoMerge !== null}`, [queuedPulls(1)], function* (h) {
			yield* h.poll;
			h.queueHas();
			h.pullIs(1, { "auto_merge": autoMerge, mergeable: false, "mergeable_state": "dirty", merged: true, state });
			yield* h.poll;
			yield* h.restart;
			expect(h.events()).toEqual([{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" }]);
		});
	}
}

watch.it("an alert-only watch stays quiet when a queued PR merges", [queuedPulls(1)], function* (h) {
	yield* h.poll;
	h.queueHas();
	h.pullIs(1, { "auto_merge": null, mergeable: false, "mergeable_state": "dirty", merged: true });
	yield* h.once("--events", "auto-merge-off,conflict,stuck,dequeued");
	yield* h.restart;
	expect(h.transitions()).toEqual([]);
});

watch.it(
	"a discovered merge is terminal even with open state and pending mergeability",
	[watchesFleet(), hasPull(1, { "auto_merge": null, mergeable: null, "mergeable_state": "unknown", merged: true })],
	function* (h) {
		yield* h.poll;
		yield* h.restart;
		expect(h.eventNames()).toEqual(["merged"]);
	},
);

watch.it(
	"disabling auto-merge on an open PR emits exactly one alert alongside a queue merge",
	[watchesPulls(1, 2), queuedPulls(1), hasPull(2)],
	function* (h) {
		yield* h.poll;
		h.queueHas();
		h.pullIs(1, { "auto_merge": null, merged: true });
		h.pullIs(2, { "auto_merge": null });
		yield* h.poll;
		yield* h.poll;
		yield* h.restart;
		expect(h.events()).toEqual([
			{ branch: "feature-1", event: "merged", number: 1, title: "Change 1" },
			{ branch: "feature-2", event: "auto-merge-off", number: 2, title: "Change 2" },
		]);
	},
);
