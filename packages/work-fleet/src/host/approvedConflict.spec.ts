import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CONFLICTING_PR_REASON } from "#host/conflictingPr.ts";
import { repairAttempts, withApprovedPrDaemon } from "#test/approvedPrDaemon.ts";
import { BASE, MOVED } from "#test/githubResult.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live");

test("daemon relaunches a conflicting approved PR once per main revision across restart", () =>
	withApprovedPrDaemon((fixture) =>
		Effect.gen(function* () {
			const initial = yield* fixture.serve((client) =>
				Effect.gen(function* () {
					const ready = yield* fixture.ready(client);
					fixture.github.state.mergeable = "CONFLICTING";
					yield* client("fleet.reconcile", { workId: "one" });
					const repair = yield* fixture.started(client, "repair");
					expect(repair.stage).toBe("executing");
					expect(repair.conflictRepairs).toEqual([BASE]);
					expect(repair.review).toBeUndefined();
					expect(repair.checks).toBeUndefined();
					expect(repair.mergeReadyHead).toBeUndefined();
					expect(repair.attempts.at(-1)?.role).toBe("repair");
					expect(repair.attempts.at(-1)?.receipt?.sessionId).toBe(ready.attempts[0]?.receipt?.sessionId);
					expect(repair.attempts.at(-1)?.prompt).toContain("Fetch and merge main once");
					expect(repair.attempts.at(-1)?.prompt).toContain(BASE);
					expect(repair.supersededDecisions?.at(-1)).toMatchObject({ boardAcknowledged: true, published: ready.decision?.published });
					return repair;
				}),
			);
			yield* fixture.serve((client) =>
				Effect.gen(function* () {
					const resumed = yield* client("fleet.reconcile", { workId: "one" });
					expect(resumed.attempts).toHaveLength(initial.attempts.length);
					expect(resumed.attempts.at(-1)?.operationId).toBe(initial.attempts.at(-1)?.operationId);
					fixture.finishWorker(initial, MOVED);
					const stillConflicting = yield* client("fleet.reconcile", { workId: "one" });
					expect(stillConflicting.decision?.reason).toBe(CONFLICTING_PR_REASON);
					expect(repairAttempts(stillConflicting)).toHaveLength(1);
					expect((yield* client("fleet.reconcile", { workId: "one" })).attempts).toEqual(stillConflicting.attempts);
					fixture.github.state.base = "d".repeat(40);
					yield* client("fleet.reconcile", { workId: "one" });
					const next = yield* fixture.started(client, "repair");
					expect(next.stage).toBe("executing");
					expect(next.conflictRepairs).toEqual([BASE, fixture.github.state.base]);
					expect(repairAttempts(next)).toHaveLength(2);
					expect(next.attempts.at(-1)?.prompt).toContain(fixture.github.state.base);
					fixture.github.state.mergeable = "MERGEABLE";
					fixture.finishWorker(next, "e".repeat(40));
					const ready = yield* client("fleet.reconcile", { workId: "one" });
					expect(ready.decision?.reason).toBe("Reviewed PR is ready to merge");
					expect(ready.review).toMatchObject({ head: fixture.github.state.head, verdict: "approved" });
					expect(ready.checks).toMatchObject({ head: fixture.github.state.head, passed: true });
					expect(repairAttempts(ready)).toHaveLength(2);
				}),
			);
		}),
	));

test("daemon preserves approval when GitHub reports a mergeable or unknown head behind a moving main", () =>
	withApprovedPrDaemon((fixture) =>
		fixture.serve((client) =>
			Effect.gen(function* () {
				const ready = yield* fixture.ready(client);
				for (const mergeable of ["MERGEABLE", "UNKNOWN"] as const) {
					fixture.github.state.mergeable = mergeable;
					fixture.github.state.base = MOVED;
					const waiting = yield* client("fleet.reconcile", { workId: "one" });
					expect(waiting).toEqual(ready);
				}
				expect(fixture.provider.launched).toHaveLength(2);
			}),
		),
	));
