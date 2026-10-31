import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { failedAnswer } from "#test/failedAnswer.ts";
import { task } from "#test/fleetHost.ts";
import { boardWork, host, storedWork } from "#test/hostStory.ts";

for (const action of ["scheduler", "close command"] as const) {
	host.it(
		`the ${action} counts released Board work as done after an answer failed`,
		[
			boardWork({ "one.md": task("one").replace("kind: task", "kind: task\nstatus: done") }),
			storedWork("one", "released", {
				attentionOwner: "orchestrator",
				blocker: "Answer failed: Decision changed",
				releaseReason: "Released by a person",
			}),
			...(action === "close command" ? [failedAnswer("one")] : []),
		],
		function* (fleet) {
			expect((yield* fleet.status()).waiting.orchestrator).toMatchObject([{ blocker: "Answer failed: Decision changed", workId: "one" }]);
			if (action === "scheduler") {
				yield* fleet.schedule();
			} else {
				const preview = yield* fleet.cli(["close-finished-decisions", "--dry-run"]);
				yield* outcomes({
					"preview counts one closure": [
						Effect.succeed(preview),
						expect.objectContaining({ code: 0, stdout: expect.stringContaining("1 decision(s) would close.") }),
					],
					"preview keeps the released work waiting": [
						fleet.status().pipe(Effect.map((overview) => overview.waiting.orchestrator)),
						[expect.objectContaining({ workId: "one" })],
					],
				});
				expect(yield* fleet.cli(["close-finished-decisions"])).toMatchObject({ code: 0, stdout: expect.stringContaining("1 decision(s) closed.") });
			}
			const status = yield* fleet.status();
			expect(status.waiting.orchestrator).toEqual([]);
			expect(status.completed).toMatchObject([{ stage: "done", workId: "one" }]);
			const record = yield* fleet.get("one");
			expect(record).toMatchObject({ releaseReason: "Released by a person", step: "done" });
			expect(record.blocker).toBeUndefined();
			expect(record.outcome).toBeUndefined();
			const cli = yield* fleet.cli(["status"]);
			expect(cli).toMatchObject({ code: 0 });
			expect(cli.stdout).toContain("Waiting on orchestrator (0)");
			expect(cli.stdout).toContain("Done (1)");
			yield* fleet.schedule();
			expect(yield* fleet.get("one")).toEqual(record);
		},
	);
}

for (const status of ["ready", "deferred", "dropped"] as const) {
	host.it(
		`released work with a failed answer and Board status ${status} is not counted as done`,
		[
			boardWork({ "one.md": task("one").replace("kind: task", `kind: task\nstatus: ${status}`) }),
			storedWork("one", "released", { attentionOwner: "orchestrator", blocker: "Answer failed: Decision changed" }),
			failedAnswer("one"),
		],
		function* (fleet) {
			yield* fleet.schedule();
			const current = yield* fleet.status();
			expect(current.completed).toEqual([]);
			expect(current.waiting.orchestrator).toMatchObject(status === "ready" ? [{ workId: "one" }] : []);
			expect((yield* fleet.get("one")).step).toBe("released");
		},
	);
}
