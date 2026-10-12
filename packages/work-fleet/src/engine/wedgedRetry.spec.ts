import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { conflictingPr } from "#engine/deliveryFailure.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { postgresTests } from "#test/postgres.ts";

postgresTests("test")("a wedged repair automatically starts a fresh thread on the same PR across restart", () => {
	let now = 100;
	let rejected = false;
	let conflicting = true;
	const rejection = new SessionFailure({
		code: "session-active-turn-exhausted",
		message: "The provider cannot accept another operation on this thread.",
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
			now: () => now,
		},
		(fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				const blocked = yield* fleet.reconcile("one");
				expect(blocked.value.decision).toBeUndefined();
				expect(blocked.value.stage).toBe("repairing");
				expect(blocked.value.launchRetry?.retryAt).toBe(30_100);
				expect(blocked.value.attempts.at(-1)).toMatchObject({ role: "repair", sessionUnusable: true, status: "failed" });
				yield* fixture.restart(fleet.reconcile("one"));
				expect(fixture.starts).toHaveLength(2);
				now = 30_100;
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
				expect(fixture.decisions).toHaveLength(0);
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
