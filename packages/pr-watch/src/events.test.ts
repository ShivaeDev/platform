import { expect } from "vitest";
import { hasPull, queuedPulls, statusIs } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

const cases = [
	{ changes: { merged: true, state: "closed" }, event: "merged" },
	{ changes: { state: "closed" }, event: "closed" },
	{ changes: { mergeable: false, "mergeable_state": "dirty" }, event: "conflict" },
	{ changes: { "auto_merge": null }, event: "auto-merge-off" },
];
for (const { event, changes } of cases) {
	watch.it(`observes ${event} once with PR identity`, [], function* (h) {
		yield* h.poll;
		h.pullIs(1, changes);
		yield* h.poll;
		expect(h.lines).toContain(JSON.stringify({ branch: "feature-1", event, number: 1, title: "Change 1" }));
		expect(h.eventNames().includes("stuck")).toBe(event === "conflict");
		const count = h.events().length;
		yield* h.restart;
		expect(h.events()).toHaveLength(count);
	});
}
watch.it("confirmed queue disappearance emits dequeued only while open", [queuedPulls(1)], function* (h) {
	yield* h.poll;
	h.queueHas();
	h.pullIs(1, { "auto_merge": null });
	yield* h.poll;
	expect(h.eventNames()).toEqual(["dequeued", "auto-merge-off"]);
	h.merged(1);
	yield* h.poll;
	expect(h.events()).toHaveLength(3);
});
watch.it("failed check runs and commit statuses produce checks-failed and stuck", [], function* (h) {
	yield* h.poll;
	h.checksAre(1, [{ conclusion: "timed_out", status: "completed" }]);
	yield* h.poll;
	expect(h.eventNames()).toEqual(["checks-failed", "stuck"]);
	h.checksAre(1, [{ conclusion: "neutral", status: "completed" }]);
	yield* h.poll;
	h.statusIs(1, "error");
	yield* h.poll;
	expect(h.eventNames()).toEqual(["checks-failed", "stuck", "checks-failed", "stuck"]);
});
watch.it(
	"enabling auto-merge on failing checks emits stuck without repeating checks-failed",
	[hasPull(1, { "auto_merge": null }), statusIs(1, "failure")],
	function* (h) {
		yield* h.poll;
		h.pullIs(1);
		yield* h.poll;
		expect(h.eventNames()).toEqual(["stuck"]);
	},
);
