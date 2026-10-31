import { expect } from "vitest";
import { host } from "#test/hostStory.ts";
import { waitCycle } from "#test/waitCycle.ts";

host.it("status and watch report an existing merge wait cycle once and leave its dependent waiting", waitCycle("merge"), function* (daemon) {
	const reason =
		"Stuck: wait cycle: one (https://example.invalid/pr/one) -> two (https://example.invalid/pr/two) -> one (https://example.invalid/pr/one)";
	const status = yield* daemon.cli(["status"]);
	expect(status.code).toBe(0);
	expect(status.stdout).toContain(`one  waiting  ${reason}`);
	expect(status.stdout.match(/Stuck: wait cycle:/gu)).toEqual(["Stuck: wait cycle:"]);
	const filtered = yield* daemon.cli(["status", "three"]);
	expect(filtered.stdout).not.toContain("Stuck: wait cycle");
	expect(filtered.stdout).toContain("three  waiting  waiting for");
	expect(filtered.stdout).not.toContain("  one  waiting");
	expect(status.stdout).toContain("ordinary  waiting  waiting for area work-board held by outside");
	yield* daemon.watchEvents({ events: "stuck,waiting-on-orchestrator" });
	yield* daemon.awaitEvent("stuck");
	yield* daemon.awaitOutput("events", '"workId":"one"');
	expect(daemon.eventLines()).toEqual([{ head: "one", kind: "stuck", pr: "https://example.invalid/pr/one", reason, workId: "one" }]);
	yield* daemon.follow("filtered", "watch", ["one"], { events: "stuck", json: true, prEvents: false });
	yield* daemon.awaitOutput("filtered", '"kind":"stuck"');
	expect(JSON.parse(daemon.followerOutput("filtered"))).toEqual({
		head: "one",
		kind: "stuck",
		pr: "https://example.invalid/pr/one",
		reason,
		workId: "one",
	});
	yield* daemon.store("two", {
		...(yield* daemon.get("two")),
		attentionOwner: "automation",
		blocker: "Waiting for required checks",
		predictedConflictHold: undefined,
		stage: "waiting",
		step: "validating",
	});
	const cleared = yield* daemon.cli(["status"]);
	expect(cleared.code).toBe(0);
	expect(cleared.stdout).not.toContain("Stuck: wait cycle");
	expect(cleared.stdout).toContain("two  waiting  Waiting for required checks");
});

host.it("an area and merge-order cycle with a repair waits on automation instead of reporting stuck", waitCycle("area"), function* (daemon) {
	const status = yield* daemon.cli(["status"]);

	expect(status.code).toBe(0);
	expect(status.stdout).not.toContain("Stuck: wait cycle");
	expect(status.stdout).toContain("one  waiting  waiting for area work-fleet held by two");
});
