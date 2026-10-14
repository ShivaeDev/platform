import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult } from "#test/githubChecks.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

test("a non-required failure never launches repair after approval", () => {
	const github = githubFixture();
	github.required(["verify"]);
	github.reply(ADOPTED_HEAD, [[checkRun({ name: "verify" }), checkRun({ conclusion: "failure", name: "publish" })]]);
	return withEngine({ checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.stage).toBe("completed");
			expect(completed.value.checks?.passed).toBe(true);
			expect(completed.value.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(0);
			expect(fixture.decisions).toHaveLength(0);
		}),
	);
});

test("a different failing required name starts a new repair sequence", () => {
	const github = githubFixture();
	github.required(["verify", "build"]);
	github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" }), checkRun({ name: "build" })]]);
	return withEngine({ checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			for (let repair = 0; repair < 3; repair += 1) {
				finishWorkers(fixture);
				yield* fleet.reconcile("one");
			}
			github.reply(ADOPTED_HEAD, [[checkRun({ name: "verify" }), checkRun({ conclusion: "failure", name: "build" })]]);
			finishWorkers(fixture);
			const repairing = yield* fleet.reconcile("one");
			expect(repairing.value.stage).toBe("executing");
			expect(repairing.value.attempts.at(-1)?.checkFailures).toEqual(["build"]);
			expect(repairing.value.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(4);
			expect(fixture.decisions).toHaveLength(0);
		}),
	);
});

test("review repair does not count as a check repair", () => {
	const github = githubFixture();
	github.required(["verify"]);
	github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "verify" })]]);
	return withEngine({ checksQuery: github.checks, repairs: true, resultQuery: () => Effect.succeed(githubResult()) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const reviewRepair = yield* fleet.reconcile("one");
			expect(reviewRepair.value.attempts.at(-1)?.checkFailures).toBeUndefined();
			for (let repair = 0; repair < 3; repair += 1) {
				finishWorkers(fixture);
				expect((yield* fleet.reconcile("one")).value.stage).toBe("executing");
			}
			finishWorkers(fixture);
			const stopped = yield* fleet.reconcile("one");
			expect(stopped.value.stage).toBe("needs-human");
			expect(stopped.value.attempts.filter((attempt) => attempt.role === "repair")).toHaveLength(4);
			expect(fixture.decisions).toHaveLength(1);
		}),
	);
});
