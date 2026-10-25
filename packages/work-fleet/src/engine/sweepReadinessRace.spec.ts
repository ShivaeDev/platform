import { Effect, Fiber } from "effect";
import { expect } from "vitest";
import { isolatedEngine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { pendingReadyPublication, sweepPullRequests, sweepRacesReadiness } from "#test/sweepPullRequests.ts";
import { sweepTask } from "#test/sweepTask.ts";

isolatedEngine.it(
	"a sweep launching during a readiness write records a hold instead of publishing a ready decision",
	[markdownWork(), sweepPullRequests(), sweepRacesReadiness("package")],
	function* ({
		fleet,
		writeBoardWork,
		configureSweepPr,
		prepareWork,
		finishWorkers,
		waitForSweepReadinessWrite,
		resumeSweepReadinessWrite,
		restart,
		observeSweepPr,
		turnOutput,
	}) {
		for (const id of ["package", "catalog"]) {
			writeBoardWork(`${id}.md`, sweepTask(id, id === "catalog" ? ["*"] : undefined));
			configureSweepPr(id, [`src/${id}.ts`]);
			yield* prepareWork(id);
		}
		yield* fleet.dispatch("package");
		finishWorkers();
		const completing = yield* fleet.reconcile("package").pipe(Effect.forkScoped);
		yield* waitForSweepReadinessWrite();
		yield* fleet.dispatch("catalog");
		yield* resumeSweepReadinessWrite();
		const held = (yield* Fiber.join(completing)).value;
		expect(held).toMatchObject({
			attentionOwner: "automation",
			blocker: "Held behind sweep catalog",
			step: "delivering",
			sweepHold: { workId: "catalog" },
		});
		expect(held.decision).toBeUndefined();
		expect(held.mergeReadyAt).toBeUndefined();
		yield* restart();
		finishWorkers();
		yield* fleet.reconcile("catalog");
		observeSweepPr("catalog", "merged");
		yield* fleet.reconcile("catalog");
		const migrated = (yield* fleet.reconcile("package")).value;
		expect(turnOutput(migrated.attempts.at(-1)?.receipt)).toContain("Fetch and merge main");
		expect(migrated.attempts.filter((attempt) => attempt.role === "repair").map((entry) => entry.operationId)).toEqual(["operation-5"]);
	},
);

isolatedEngine.it(
	"a pending ready publication is held before the Board accepts it when a sweep launches",
	[markdownWork(), sweepPullRequests(), pendingReadyPublication()],
	function* ({ fleet, writeBoardWork, configureSweepPr, prepareWork, finishWorkers, restart, publishedMergeReadiness }) {
		for (const id of ["package", "catalog"]) {
			writeBoardWork(`${id}.md`, sweepTask(id, id === "catalog" ? ["*"] : undefined));
			configureSweepPr(id, [`src/${id}.ts`]);
			yield* prepareWork(id);
		}
		yield* fleet.dispatch("package");
		finishWorkers();
		const pending = (yield* fleet.reconcile("package")).value;
		expect(pending.decision?.code).toBe("reviewed-pr-ready");
		expect(pending.decision?.published).toBeUndefined();
		yield* fleet.dispatch("catalog");
		yield* restart();
		const held = (yield* fleet.reconcile("package")).value;
		expect(held.blocker).toBe("Held behind sweep catalog");
		expect(held.decision).toBeUndefined();
		expect(publishedMergeReadiness()).toHaveLength(0);
	},
);
