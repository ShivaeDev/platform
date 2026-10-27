import { Clock } from "effect";
import { expect } from "vitest";
import { queuedPulls } from "#test/traits.ts";
import { watch } from "#test/watch.ts";

watch.it("a piped fleet watch emits a selected dequeue within one interval and reports its stop", [queuedPulls(1)], function* (h) {
	yield* h.poll;
	yield* h.cliStart("--events", "dequeued", "--heartbeat", "0.1");
	yield* h.cliWaitFor("heartbeat");
	const interval = 1000;
	yield* h.elapse(interval / 2);
	const droppedAt = yield* Clock.currentTimeMillis;
	h.queueHas();
	h.pullIs(1, { "auto_merge": null });
	yield* h.cliWaitFor("dequeued");
	const elapsed = (yield* Clock.currentTimeMillis) - droppedAt;
	expect(elapsed).toBeLessThanOrEqual(interval);
	expect(h.cliLines().filter((line) => line.number !== undefined)).toEqual([
		{ branch: "feature-1", event: "dequeued", number: 1, reason: "Queue entry removed; GitHub supplied no reason", title: "Change 1" },
	]);
	yield* h.cliStop();
	yield* h.cliFinish();
	expect((yield* h.stored()).prs["1"].queued).toBe(false);
	expect(h.cliLines().at(-1)).toMatchObject({ event: "stopped" });
});

watch.it("event selection emits multiple chosen transitions and acknowledges omitted ones", [queuedPulls(1)], function* (h) {
	yield* h.poll;
	h.queueHas();
	h.pullIs(1, { "auto_merge": null, mergeable: false, "mergeable_state": "dirty" });
	h.statusIs(1, "failure");
	yield* h.once("--events", "dequeued,checks-failed");
	expect(h.eventNames()).toEqual(["dequeued", "checks-failed", "stopped"]);
	yield* h.once();
	expect(h.eventNames()).toEqual(["dequeued", "checks-failed", "stopped", "stopped"]);
	expect((yield* h.stored()).prs["1"]).toMatchObject({ autoMerge: false, dirty: true, failed: true, queued: false });
});

watch.it("an unknown event kind fails startup with valid choices before polling", [], function* (h) {
	const result = yield* h.cliRun("--fleet", "--events", "dequed");
	const exitCode = result.code;
	expect(exitCode).toBe(1);
	const lines = result.stdout
		.trim()
		.split("\n")
		.map((line) => JSON.parse(line));
	expect(lines.map((line) => line.event)).toEqual(["error", "stopped"]);
	expect(lines[0].message).toContain("Unknown event kind");
	expect(lines[0].message).toContain("Valid kinds: merged, closed, conflict, queued, dequeued, auto-merge-off, checks-failed, stuck");
	expect(h.requests).toEqual([]);
});
