import { expect } from "vitest";
import { engine } from "#test/engineStory.ts";
import { markdownWork } from "#test/engineTraits.ts";
import { prepared } from "#test/preparation.ts";
import { sweepPullRequests } from "#test/sweepPullRequests.ts";
import { sweepTask } from "#test/sweepTask.ts";

engine.it(
	"a held PR conflicting after its sweep merges receives one contextual migration repair and fresh review",
	[markdownWork(), sweepPullRequests()],
	function* ({ fleet, writeBoardWork, configureSweepPr, finishWorkers, observeSweepPr, sweepConflicts, restart, turnOutput, reviewedHeads }) {
		const brief = sweepTask("catalog", ["**/package.json"]);
		for (const [id, paths] of [
			["package", ["packages/example/package.json"]],
			["catalog", ["pnpm-workspace.yaml"]],
		] as const) {
			writeBoardWork(`${id}.md`, id === "catalog" ? brief : sweepTask(id));
			configureSweepPr(id, paths);
			yield* fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: paths }), prompt: `Implement ${id}`, workId: id });
		}
		yield* fleet.dispatch("package");
		yield* fleet.dispatch("catalog");
		finishWorkers();
		const held = (yield* fleet.reconcile("package")).value;
		expect(held.blocker).toBe("Held behind sweep catalog");
		expect(held.sweepHold?.context).toBe(brief);
		yield* fleet.reconcile("catalog");
		const previousReviews = reviewedHeads();
		observeSweepPr("catalog", "merged");
		expect((yield* fleet.reconcile("catalog")).value.step).toBe("done");
		sweepConflicts("package", true);
		yield* restart();
		const migrating = (yield* fleet.reconcile("package")).value;
		expect(migrating.attempts.at(-1)).toMatchObject({ role: "repair", status: "accepted" });
		expect(turnOutput(migrating.attempts.at(-1)?.receipt)).toContain(brief);
		expect(turnOutput(migrating.attempts.at(-1)?.receipt)).toContain("Fetch and merge main");
		expect(migrating.sweepHold).toBeUndefined();
		expect(migrating.review).toBeUndefined();
		expect(migrating.checks).toBeUndefined();
		yield* restart();
		yield* fleet.reconcile("package");
		sweepConflicts("package", false);
		finishWorkers();
		const ready = (yield* fleet.reconcile("package")).value;
		expect(ready.result?.head).not.toBe(held.result?.head);
		expect(ready.review).toMatchObject({ head: ready.result?.head, verdict: "approved" });
		expect(ready.checks).toMatchObject({ head: ready.result?.head, passed: true });
		expect(reviewedHeads()).toEqual([...previousReviews, ready.result?.head]);
		expect(ready.decision?.code).toBe("reviewed-pr-ready");
		expect(ready.sweepHold).toBeUndefined();
		expect(ready.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(1);
		yield* restart();
		const reconciled = (yield* fleet.reconcile("package")).value;
		expect(reconciled.decision?.code).toBe("reviewed-pr-ready");
		expect(reconciled.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(1);
	},
);
