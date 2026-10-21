import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { CONFLICTING_PR_REASON } from "#engine/deliveryFailure.ts";
import { repairAttempts, reviewHeads, withApprovedPrDaemon } from "#test/approvedPrDaemon.ts";
import { HEAD, MOVED } from "#test/githubResult.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live");

for (const body of ["", "Preserve the loading indicator."]) {
	test(`conflict retry repairs the existing PR before reviewing again with text=${body !== ""}`, () =>
		withApprovedPrDaemon((fixture) =>
			Effect.gen(function* () {
				const resolved = yield* fixture.serve((client) =>
					Effect.gen(function* () {
						yield* fixture.ready(client);
						fixture.github.state.mergeable = "CONFLICTING";
						yield* client("fleet.reconcile", { workId: "one" });
						const automatic = yield* fixture.started(client, "repair");
						fixture.finishWorker(automatic);
						const blocked = yield* client("fleet.reconcile", { workId: "one" });
						expect(blocked.decision?.reason).toBe(CONFLICTING_PR_REASON);
						const response = fixture.answer(blocked, body, "orchestrator");
						const queued = yield* client("fleet.resolve", response);
						expect(queued.step).toBe("repairing");
						expect(queued.review).toBeUndefined();
						expect(queued.checks).toBeUndefined();
						expect(queued.responses?.at(-1)).toMatchObject({ boardAcknowledged: true, responseId: response.responseId });
						return { blocked, response };
					}),
				);
				yield* fixture.serve((client) =>
					Effect.gen(function* () {
						yield* client("fleet.reconcile", { workId: "one" });
						const launched = yield* fixture.started(client, "repair");
						const repair = launched.attempts.at(-1);
						expect(repairAttempts(launched)).toHaveLength(2);
						expect(repair?.receipt?.sessionId).toBe(resolved.blocked.attempts[0]?.receipt?.sessionId);
						expect(repair?.prompt).toContain("Fetch and merge main");
						expect(repair?.prompt).toContain(`same branch and PR (${fixture.PR})`);
						expect(repair?.prompt).toContain("push the changes");
						if (body) {
							expect(repair?.prompt).toContain(body);
						}
						expect(reviewHeads(launched)).toEqual(reviewHeads(resolved.blocked));
						expect((yield* client("fleet.resolve", resolved.response)).attempts).toEqual(launched.attempts);
						fixture.github.state.mergeable = "MERGEABLE";
						fixture.finishWorker(launched, MOVED);
						const reviewed = yield* client("fleet.reconcile", { workId: "one" });
						expect(reviewed.result).toMatchObject({ head: MOVED, pr: fixture.PR });
						expect(reviewed.review).toMatchObject({ head: MOVED, verdict: "approved" });
						expect(reviewed.checks).toMatchObject({ head: MOVED, passed: true });
						expect(reviewHeads(reviewed)).toEqual([HEAD, HEAD, MOVED]);
					}),
				);
			}),
		));
}
