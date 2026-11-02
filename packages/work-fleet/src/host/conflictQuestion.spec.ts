import { expect } from "@effect/vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { CONFLICTING_PR_REASON } from "#engine/deliveryFailure.ts";
import { conflictDaemon, legacyConflictQuestion, reviewedAtCapacity, reviewedWithBusySlot } from "#test/conflictDaemon.ts";

conflictDaemon.it("a reviewed PR launches its conflict repair while open-PR capacity is full", [reviewedAtCapacity], function* (daemon) {
	yield* outcomes([
		["reviewed PR", () => daemon.get("one"), { decision: { code: "reviewed-pr-ready" }, step: "waiting" }],
		["other open PR", () => daemon.get("other"), { result: { kind: "change" }, step: "waiting" }],
	]);
	yield* daemon.schedulerPass();
	expect(yield* daemon.get("new")).toMatchObject({ blocker: "waiting for open PRs to merge: 2 of 1", step: "queued" });

	daemon.conflict();
	yield* daemon.schedulerPass();

	expect(yield* daemon.get("one")).toMatchObject({
		attempts: expect.arrayContaining([expect.objectContaining({ prompt: expect.stringContaining("Fetch and merge main once"), role: "repair" })]),
		step: "working",
	});
});

conflictDaemon.it("a repeated conflict question stays answerable at full open-PR capacity", [reviewedAtCapacity], function* (daemon) {
	daemon.conflict();
	yield* daemon.schedulerPass();
	const repair = yield* daemon.get("one");
	daemon.finishReviewedWorker(repair);
	yield* daemon.schedulerPass();
	const question = yield* daemon.get("one");
	expect(question).toMatchObject({ decision: { reason: CONFLICTING_PR_REASON }, step: "waiting" });

	const answer = yield* daemon.cli(["answer", "one", "Preserve the loading indicator."]);

	expect(answer).toMatchObject({ code: 0 });
	yield* daemon.appliedAnswer("one");
	yield* daemon.schedulerPass();
	expect((yield* daemon.get("one")).attempts.at(-1)).toMatchObject({
		prompt: expect.stringContaining("Preserve the loading indicator."),
		role: "repair",
	});
});

conflictDaemon.it(
	"an upgraded conflict question launches a repair with CLI guidance at full open-PR capacity",
	[reviewedAtCapacity, legacyConflictQuestion],
	function* (daemon) {
		const answer = yield* daemon.cli(["answer", "one", "Preserve the loading indicator."]);

		expect(answer).toMatchObject({ code: 0 });
		yield* daemon.appliedAnswer("one");
		yield* daemon.schedulerPass();
		expect((yield* daemon.get("one")).attempts.at(-1)).toMatchObject({
			prompt: expect.stringContaining("Preserve the loading indicator."),
			role: "repair",
		});
	},
);

conflictDaemon.it(
	"an upgraded conflict question releases through the CLI at full open-PR capacity",
	[reviewedAtCapacity, legacyConflictQuestion],
	function* (daemon) {
		const release = yield* daemon.cli(["answer", "one", "--release"]);

		expect(release).toMatchObject({ code: 0 });
		expect(yield* daemon.appliedAnswer("one")).toMatchObject({ step: "released" });
	},
);

conflictDaemon.it(
	"an unchanged conflicting head emits its question once across scheduler passes before release",
	[reviewedAtCapacity],
	function* (daemon) {
		yield* daemon.watchEvents({ events: "waiting-on-orchestrator,released" });
		yield* daemon.awaitSnapshot();
		daemon.conflict();
		yield* daemon.schedulerPass();
		daemon.finishReviewedWorker(yield* daemon.get("one"));
		yield* daemon.schedulerPass();
		yield* daemon.awaitOutput("events", CONFLICTING_PR_REASON);

		yield* daemon.schedulerPass();
		yield* daemon.schedulerPass();

		const release = yield* daemon.cli(["answer", "one", "--release"]);
		expect(release).toMatchObject({ code: 0 });
		yield* daemon.appliedAnswer("one");
		yield* daemon.awaitEvent("released");
		expect(daemon.eventLines()).toEqual([
			expect.objectContaining({
				head: (yield* daemon.get("one")).result?.head,
				kind: "waiting-on-orchestrator",
				reason: CONFLICTING_PR_REASON,
				workId: "one",
			}),
			expect.objectContaining({ kind: "released", workId: "one" }),
		]);
	},
);

conflictDaemon.it(
	"a conflict repair waits for an execution slot without re-asking and launches despite full open-PR capacity",
	[reviewedWithBusySlot],
	function* (daemon) {
		daemon.conflict();
		yield* daemon.schedulerPass();
		expect(yield* daemon.get("one")).toMatchObject({ blocker: "execution capacity is occupied (limit 1)", step: "repairing" });

		yield* daemon.schedulerPass();

		const queued = yield* daemon.get("one");
		expect(queued.step).toBe("repairing");
		expect(queued.decision).toBeUndefined();
		daemon.finishTurn(yield* daemon.get("other"));
		yield* daemon.reconcile("other");

		yield* daemon.schedulerPass();

		expect(yield* daemon.get("one")).toMatchObject({
			attempts: expect.arrayContaining([expect.objectContaining({ role: "repair" })]),
			step: "working",
		});
		expect(daemon.providerTurns().at(-1)?.prompt).toContain("Fetch and merge main once");
	},
);
