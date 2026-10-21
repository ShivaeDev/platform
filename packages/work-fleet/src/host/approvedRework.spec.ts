import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { repairAttempts, reviewHeads, withApprovedPrDaemon } from "#test/approvedPrDaemon.ts";
import { answerAndWait } from "#test/daemonActions.ts";
import { BASE, HEAD, MOVED } from "#test/githubResult.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("live");

for (const conflicting of [false, true]) {
	test(`daemon reconciliation consumes retry text when conflict=${conflicting}`, () =>
		withApprovedPrDaemon((fixture) =>
			fixture.serve((client) =>
				Effect.gen(function* () {
					const ready = yield* fixture.ready(client);
					const response = fixture.answer(ready, "Keep the loading indicator visible.");
					if (conflicting) {
						fixture.github.state.mergeable = "CONFLICTING";
					}
					yield* client("fleet.reconcile", { workId: "one" });
					const repaired = yield* fixture.started(client, "repair");
					expect(repaired.step).toBe("working");
					expect(repaired.attempts.at(-1)?.prompt).toContain("Keep the loading indicator visible.");
					expect(repaired.attempts.at(-1)?.receipt?.sessionId).toBe(ready.attempts[0]?.receipt?.sessionId);
					expect(repaired.responses?.at(-1)).toMatchObject({ boardAcknowledged: true, responseId: response.responseId });
					expect(repairAttempts(repaired)).toHaveLength(1);
					if (conflicting) {
						expect(repaired.conflictRepairs).toEqual([BASE]);
						expect(repaired.attempts.at(-1)?.prompt).toContain("Fetch and merge main once");
					}
				}),
			),
		));
}

for (const author of ["maintainer", "orchestrator"]) {
	test(`daemon sends ${author} retry text to the same worker and reviews its new PR head after restart`, () =>
		withApprovedPrDaemon((fixture) =>
			Effect.gen(function* () {
				const resolved = yield* fixture.serve((client) =>
					Effect.gen(function* () {
						let ready = yield* fixture.ready(client);
						expect(ready.decision?.reason).toBe("Reviewed PR is ready to merge");
						if (author === "orchestrator" && ready.decision !== undefined) {
							ready = yield* client("fleet.reassign", { attentionOwner: "orchestrator", decisionId: ready.decision.id, workId: "one" });
						}
						const response = fixture.answer(ready, "Preserve the empty state and add its regression test.", author);
						const queued = yield* client("fleet.resolve", response);
						expect(queued.step).toBe("repairing");
						expect(queued.prompt).toContain("Preserve the empty state and add its regression test.");
						expect(queued.checks).toBeUndefined();
						expect(queued.review).toBeUndefined();
						expect(queued.mergeReadyHead).toBeUndefined();
						expect(queued.responses?.at(-1)).toMatchObject({ boardAcknowledged: true, responseId: response.responseId });
						return { ready, response };
					}),
				);
				yield* fixture.serve((client) =>
					Effect.gen(function* () {
						yield* client("fleet.reconcile", { workId: "one" });
						const launched = yield* fixture.started(client, "repair");
						const repair = launched.attempts.at(-1);
						expect(launched.step).toBe("working");
						expect(repair?.role).toBe("repair");
						expect(repair?.receipt?.sessionId).toBe(resolved.ready.attempts[0]?.receipt?.sessionId);
						expect(repair?.prompt).toContain("Preserve the empty state and add its regression test.");
						expect(repair?.prompt).toContain(`same branch and PR (${fixture.PR})`);
						expect(fixture.provider.observations.get(repair?.receipt?.turnId ?? "")?.output).toBe(repair?.prompt);
						expect((yield* client("fleet.resolve", resolved.response)).attempts).toEqual(launched.attempts);
						fixture.finishWorker(launched, MOVED);
						const reviewed = yield* client("fleet.reconcile", { workId: "one" });
						expect(reviewed.step).toBe("waiting");
						expect(reviewed.result).toMatchObject({ head: MOVED, pr: fixture.PR });
						expect(reviewed.review).toMatchObject({ head: MOVED, verdict: "approved" });
						expect(reviewed.checks).toMatchObject({ head: MOVED, passed: true });
						expect(reviewHeads(reviewed)).toEqual([HEAD, MOVED]);
						expect(repairAttempts(reviewed)).toHaveLength(1);
					}),
				);
			}),
		));
}

test("daemon retries an unchanged approved head without text by republishing merge readiness", () =>
	withApprovedPrDaemon((fixture) =>
		fixture.serve((client) =>
			Effect.gen(function* () {
				let ready = yield* fixture.ready(client);
				for (const body of ["", "  \n  "]) {
					fixture.answer(ready, body);
					const retried = yield* client("fleet.reconcile", { workId: "one" });
					expect(retried.decision?.reason).toBe("Reviewed PR is ready to merge");
					expect(retried.decision?.id).not.toBe(ready.decision?.id);
					expect(retried.result).toEqual(ready.result);
					expect(retried.review).toEqual(ready.review);
					expect(retried.checks).toEqual(ready.checks);
					expect(retried.attempts).toEqual(ready.attempts);
					expect(fixture.provider.launched).toHaveLength(2);
					ready = retried;
				}
			}),
		),
	));

test("answer text queues requested changes on the same branch and PR through daemon HTTP", () =>
	withApprovedPrDaemon((fixture) =>
		fixture.serve((client) =>
			Effect.gen(function* () {
				const ready = yield* fixture.ready(client);
				const queued = yield* answerAndWait(client, { text: "Keep the loading indicator visible.", workId: "one" });
				expect(queued.step).toBe("repairing");
				expect(queued.responses?.at(-1)).toMatchObject({ action: "retry", boardAcknowledged: true });
				yield* client("fleet.reconcile", { workId: "one" });
				const reworked = yield* fixture.started(client, "repair");
				expect(reworked.result).toEqual(ready.result);
				expect(reworked.attempts.at(-1)?.receipt?.sessionId).toBe(ready.attempts[0]?.receipt?.sessionId);
				expect(reworked.attempts.at(-1)?.prompt).toContain("Keep the loading indicator visible.");
				expect(reworked.attempts.at(-1)?.prompt).toContain(`same branch and PR (${fixture.PR})`);
			}),
		),
	));

test("answer without text retries a ready PR without requesting rework", () =>
	withApprovedPrDaemon((fixture) =>
		fixture.serve((client) =>
			Effect.gen(function* () {
				const ready = yield* fixture.ready(client);
				const retried = yield* answerAndWait(client, { workId: "one" });
				expect(retried.step).toBe("delivering");
				const waiting = yield* client("fleet.reconcile", { workId: "one" });
				expect(waiting.decision?.code).toBe("reviewed-pr-ready");
				expect(waiting.attempts).toEqual(ready.attempts);
				expect(repairAttempts(waiting)).toHaveLength(0);
			}),
		),
	));
