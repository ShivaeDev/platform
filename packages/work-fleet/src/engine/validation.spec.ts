import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import { ADOPTED_HEAD, checkRun, githubFixture, githubResult, NEW_HEAD } from "#test/githubChecks.ts";
import { postgresTests } from "#test/postgres.ts";

const test = postgresTests("test");

test("pending checks survive restart in validation, then deliver when the adopted SHA turns green", () => {
	const github = githubFixture();
	github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, status: "queued" })]]);
	return withEngine({ checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			const pending = yield* fleet.reconcile("one");
			expect(pending.value.stage).toBe("validating");
			expect(pending.value.checks).toMatchObject({ head: ADOPTED_HEAD, pending: true });
			expect((yield* fixture.restart(Fleet.pipe(Effect.flatMap((resumed) => resumed.reconcile("one"))))).value.stage).toBe("validating");
			expect(fixture.decisions).toHaveLength(0);
			expect(fixture.merged).toHaveLength(0);
			expect(fixture.launched).toHaveLength(2);
			github.reply(ADOPTED_HEAD, [[checkRun()]]);
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.stage).toBe("completed");
			expect(completed.value.checks).toMatchObject({ head: ADOPTED_HEAD, passed: true, pending: false });
			expect(fixture.merged).toEqual([ADOPTED_HEAD]);
			expect(fixture.reviews).toHaveLength(1);
		}),
	);
});

test("pending checks that fail send names and logs to repair and revalidate its new head", () => {
	const github = githubFixture();
	github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, status: "in_progress" })]]);
	let head = ADOPTED_HEAD;
	return withEngine({ checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult(head)) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("validating");
			github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: "failure", name: "build" })]]);
			const repair = yield* fleet.reconcile("one");
			expect(repair.value.stage).toBe("executing");
			const attempt = repair.value.attempts.at(-1);
			expect(attempt?.role).toBe("repair");
			const prompt = fixture.observations.get(attempt?.receipt?.turnId ?? "missing")?.output;
			expect(prompt).toContain("build: https://example.invalid/logs/test");
			expect(prompt).toContain(ADOPTED_HEAD);
			expect(fixture.merged).toHaveLength(0);
			expect(fixture.decisions).toHaveLength(0);
			head = NEW_HEAD;
			github.reply(NEW_HEAD, [[checkRun({ headSha: NEW_HEAD })]]);
			finishWorkers(fixture);
			const completed = yield* fleet.reconcile("one");
			expect(completed.value.stage).toBe("completed");
			expect(completed.value.checks?.head).toBe(NEW_HEAD);
			expect(fixture.reviews).toEqual([ADOPTED_HEAD, NEW_HEAD]);
		}),
	);
});

test("a newer green push leaves the adopted pending head in validation", () => {
	const github = githubFixture();
	github.reply(ADOPTED_HEAD, [[checkRun({ conclusion: null, status: "queued" })]]);
	github.reply(NEW_HEAD, [[checkRun({ headSha: NEW_HEAD })]]);
	return withEngine({ checksQuery: github.checks, resultQuery: () => Effect.succeed(githubResult()) }, (fixture) =>
		Effect.gen(function* () {
			yield* prepareWork("one");
			const fleet = yield* Fleet;
			yield* fleet.dispatch("one");
			finishWorkers(fixture);
			expect((yield* fleet.reconcile("one")).value.stage).toBe("validating");
			expect((yield* fleet.reconcile("one")).value.checks?.head).toBe(ADOPTED_HEAD);
			expect(fixture.merged).toHaveLength(0);
			expect(github.requests.every((request) => request.includes(ADOPTED_HEAD))).toBe(true);
		}),
	);
});
