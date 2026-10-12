import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { conflictingPr } from "#engine/deliveryFailure.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

postgresTests("test")("retry of a wedged repair starts a fresh thread on the same PR across restart", () => {
	let rejected = false;
	let conflicting = true;
	const rejection = new SessionFailure({
		message: "turn already active for thread; active-turn resubmission limit reached",
		reason: "rejected",
	});
	return withEngine(
		{
			decorateTransport: (transport) => ({
				...transport,
				startTurn: (input) => {
					if (!rejected && input.prompt.includes("Fetch and merge main")) {
						rejected = true;
						return Effect.fail(rejection);
					}
					return transport.startTurn(input);
				},
			}),
			deliveryQuery: () => (conflicting ? Effect.fail(conflictingPr("main-revision")) : Effect.succeed(undefined)),
		},
		(fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				const blocked = yield* fleet.reconcile("one");
				expect(blocked.value.decision?.reason).toContain("active-turn resubmission limit reached");
				expect(blocked.value.attempts.at(-1)).toMatchObject({ role: "repair", status: "failed" });
				const decisionId = blocked.value.decision?.id ?? "missing";
				const responseId = fixture.respond(decisionId, "retry");
				const queued = yield* fleet.resolve("one", decisionId, responseId);
				expect(queued.value.stage).toBe("repairing");
				expect(queued.value.attempts.at(-1)?.sessionUnusable).toBe(true);
				const repair = yield* fixture.restart(fleet.reconcile("one"));
				expect(repair.value.stage).toBe("executing");
				expect(repair.value.result).toEqual(blocked.value.result);
				const attempt = repair.value.attempts.at(-1);
				expect(attempt?.role).toBe("repair");
				expect(attempt?.receipt?.sessionId).not.toBe(blocked.value.attempts[0]?.receipt?.sessionId);
				expect(fixture.starts.at(-1)?.prompt).toContain("Fetch and merge main");
				expect(fixture.starts.at(-1)?.prompt).toContain(
					`same branch and PR (${blocked.value.result?.kind === "change" ? blocked.value.result.pr : ""})`,
				);
				expect(fixture.starts.at(-1)?.cwd).toBe(blocked.value.cwd);
				expect(fixture.reviews).toEqual(["head-one-0"]);
				expect((yield* fleet.resolve("one", decisionId, responseId)).value.attempts).toEqual(repair.value.attempts);
				conflicting = false;
				finishWorkers(fixture);
				const reviewed = yield* fleet.reconcile("one");
				expect(reviewed.value.result).toMatchObject({
					head: "head-one-1",
					pr: blocked.value.result?.kind === "change" ? blocked.value.result.pr : "",
				});
				expect(reviewed.value.review).toMatchObject({ head: "head-one-1", verdict: "approved" });
				expect(fixture.reviews).toEqual(["head-one-0", "head-one-1"]);
			}),
	);
});
