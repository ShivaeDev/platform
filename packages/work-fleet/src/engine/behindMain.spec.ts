import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { prepareWork, withEngine } from "#test/engine.ts";
import { checkRun, githubFixture } from "#test/githubChecks.ts";
import { BASE, HEAD, MOVED, PR, REPORT, resultFixture } from "#test/githubResult.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

test("adopts and delivers an approved, conflict-free head behind main without repeating review or validation", () => {
	const adopted = resultFixture({
		after: { base: { ref: "main", sha: MOVED }, "changed_files": 1 },
		before: { "changed_files": 1 },
		files: [[{ filename: "src/one.ts" }]],
		mainHead: MOVED,
	});
	const github = githubFixture("example/repository");
	github.reply(HEAD, [[checkRun({ headSha: HEAD })]]);
	const checkedHeads: string[] = [];
	const open = {
		baseRefOid: BASE,
		headRefOid: HEAD,
		mergeable: "MERGEABLE",
		mergeCommit: null,
		mergedAt: null,
		mergeStateStatus: "BEHIND",
		state: "OPEN",
		url: PR,
	};
	let observation: unknown = open;
	return withEngine(
		{
			checksQuery: (result) => {
				checkedHeads.push(result.head);
				return github.checks(result);
			},
			deliveryQuery: githubDelivery(() => Effect.succeed(observation)),
			resultQuery: adopted.adopt,
		},
		(fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				for (const [turn, value] of fixture.observations) {
					fixture.observations.set(turn, { ...value, execution: "completed", output: REPORT });
				}
				const ready = yield* fleet.reconcile("one");
				expect(ready.value.stage).toBe("needs-human");
				expect(ready.value.decision?.reason).toBe("Reviewed PR is ready to merge");
				expect(ready.value.review).toMatchObject({ head: HEAD, verdict: "approved" });
				expect(ready.value.checks).toMatchObject({ head: HEAD, passed: true });
				observation = { ...open, baseRefOid: MOVED };
				expect((yield* fleet.reconcile("one")).version).toBe(ready.version);
				const waiting = yield* fixture.restart(Effect.flatMap(Fleet, (resumed) => resumed.reconcile("one")));
				expect(waiting.version).toBe(ready.version);
				observation = { ...open, baseRefOid: MOVED, mergeCommit: { oid: "merge-revision" }, mergedAt: "2026-01-01T00:00:00Z", state: "MERGED" };
				const delivered = yield* fleet.reconcile("one");
				expect(delivered.value.stage).toBe("completed");
				expect(delivered.value.outcome).toEqual({ head: HEAD, revision: "merge-revision", url: PR });
				expect(checkedHeads).toEqual([HEAD]);
				expect(fixture.reviews).toEqual([HEAD]);
				expect(fixture.launched).toHaveLength(2);
				expect(fixture.merged).toEqual([]);
			}),
	);
});
