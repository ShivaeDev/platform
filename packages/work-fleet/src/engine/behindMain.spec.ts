import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { engine } from "#test/engineStory.ts";
import { HEAD, MOVED, PR, REPORT } from "#test/githubResult.ts";
import { pullRequestIsBehindMain } from "#test/pullRequestIsBehindMain.ts";

{
	const setup = pullRequestIsBehindMain();
	engine.it(
		"adopts and delivers an approved, conflict-free head behind main without repeating review or validation",
		[setup.given],
		function* ({ fixture, fleet, prepareWork, restart }) {
			const context = setup.context();
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			for (const [turn, value] of fixture.observations) {
				fixture.observations.set(turn, { ...value, execution: "completed", output: REPORT });
			}
			const ready = yield* fleet.reconcile("one");
			expect(ready.value.stage).toBe("needs-human");
			expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
			expect(ready.value.review).toMatchObject({ head: HEAD, verdict: "approved" });
			expect(ready.value.checks).toMatchObject({ head: HEAD, passed: true });
			context.observation = { ...context.open, baseRefOid: MOVED };
			expect((yield* fleet.reconcile("one")).version).toBe(ready.version);
			const waiting = yield* restart(Effect.flatMap(Fleet, (resumed) => resumed.reconcile("one")));
			expect(waiting.version).toBe(ready.version);
			context.observation = {
				...context.open,
				baseRefOid: MOVED,
				mergeCommit: { oid: "merge-revision" },
				mergedAt: "2026-01-01T00:00:00Z",
				state: "MERGED",
			};
			const delivered = yield* fleet.reconcile("one");
			expect(delivered.value.stage).toBe("completed");
			expect(delivered.value.outcome).toEqual({ head: HEAD, revision: "merge-revision", url: PR });
			expect(context.checkedHeads).toEqual([HEAD]);
			expect(fixture.reviews).toEqual([HEAD]);
			expect(fixture.launched).toHaveLength(2);
			expect(fixture.merged).toEqual([]);
		},
	);
}
