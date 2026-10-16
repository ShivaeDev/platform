import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

test("a check repair without a new head revalidates without another review after restart", () => {
	const github = githubFixture();
	github.required(["verify"]);
	github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
	return withEngine({ checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const repairing = yield* fleet.reconcile("one");
			expect(repairing.value.attempts.at(-1)?.role).toBe("repair");
			const review = repairing.value.review;
			github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, name: "verify", status: "in_progress" })]]);
			finishWorkers(fixture);
			const pending = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
			expect(pending.value.stage).toBe("validating");
			expect(pending.value.review).toEqual(review);
			expect(fixture.reviews).toEqual([ADOPTED_HEAD]);
			github.reply(ADOPTED_HEAD, [[checkRun({ name: "verify" })]]);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("completed");
			expect(fixture.reviews).toEqual([ADOPTED_HEAD]);
		}),
	);
});

test("three no-op check repairs exhaust despite a rejected submission between them", () => {
	const github = githubFixture();
	github.required(["verify"]);
	github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
	let reject = false;
	let now = 100;
	return withEngine(
		{
			checksQuery: github.checks,
			decorateTransport: (transport) => ({
				...transport,
				startTurn: (input) =>
					reject && input.access !== "read-only"
						? Effect.fail(new SessionFailure({ message: "Selected model is at capacity", reason: "rejected" }))
						: transport.startTurn(input),
			}),
			now: () => now,
			resultQuery: () => Effect.succeed(githubResult()),
		},
		(fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				finishWorkers(fixture);
				reject = true;
				const rejected = yield* fleet.reconcile("one");
				expect(rejected.value.attempts.at(-1)).toMatchObject({ role: "repair", status: "failed" });
				expect(rejected.value.attempts.at(-1)?.receipt).toBeUndefined();
				reject = false;
				now += 30_000;
				yield* fleet.reconcile("one");
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
				finishWorkers(fixture);
				const stopped = yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))));
				expect(stopped.value).toMatchObject({ decision: { code: "checks-repair-exhausted" }, stage: "needs-human" });
				expect(stopped.value.attempts.filter((attempt) => attempt.role === "repair" && attempt.status === "completed")).toHaveLength(3);
				expect(fixture.decisions).toHaveLength(1);
			}),
	);
});
