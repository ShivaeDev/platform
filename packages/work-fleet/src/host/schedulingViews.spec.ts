import { Effect } from "effect";
import { expect } from "vitest";
import { task } from "#test/fleetHost.ts";
import { boardWork, host } from "#test/hostStory.ts";

host.it(
	"area and dependency admission reasons reach status, wait and the generated Board view",
	[
		boardWork({
			"a.md": task("first", "approved").replace("kind: task", "kind: task\nareas: [fleet/host]"),
			"b.md": task("second", "approved").replace("kind: task", "kind: task\nareas: [fleet/host]"),
			"c.md": task("dependent", "approved").replace("kind: task", "kind: task\nrelationships:\n  - kind: depends_on\n    target: external"),
			"external.md": task("external").replace("kind: task", "kind: task\nstatus: draft"),
		}),
	],
	function* (daemon) {
		yield* daemon.admit();
		yield* daemon.schedule();
		yield* daemon.fleetDispatch("second").pipe(Effect.result);
		const grouped = yield* daemon.status();
		expect(grouped.waiting.automation.map((record) => record.workId).toSorted()).toEqual(["dependent", "second"]);
		expect(grouped.waiting.orchestrator.map((record) => record.workId)).toEqual([]);
		const areaReason = "waiting for area fleet/host held by first";
		const dependencyReason = "waiting for dependency external";
		const status = yield* daemon.renderedStatus();
		yield* daemon.awaitBoardText("fleet/status.md", dependencyReason);
		const board = daemon.readBoard("fleet/status.md");
		for (const view of [status, board]) {
			expect(view).toContain(areaReason);
			expect(view).toContain(dependencyReason);
		}
		const states = yield* daemon.summaries(["second", "dependent"]);
		expect(states.map((state) => state.blocker).join("\n")).toContain(areaReason);
		expect(states.map((state) => state.blocker).join("\n")).toContain(dependencyReason);
		for (const [workId, reason] of [
			["second", areaReason],
			["dependent", dependencyReason],
		] as const) {
			const outcome = yield* daemon.wait(workId, 100);
			const exitCode = outcome.code;
			expect(exitCode).toBe(2);
			expect(outcome.summary).toContain(reason);
		}
		daemon.writeBoard("external.md", task("external").replace("kind: task", "kind: task\nstatus: done"));
		expect((yield* daemon.fleetDispatch("dependent")).value.step).toBe("working");
	},
);
