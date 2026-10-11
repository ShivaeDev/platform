import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { Fleet } from "#fleet.ts";
import { finishWorkers, prepareWork, withEngine } from "#test/engine.ts";
import type { EngineProvider } from "#test/engineProvider.ts";
import { HEAD, MOVED, NO_CHANGE, PR, REPORT, resultFixture } from "#test/githubResult.ts";
import { storageDatabaseUrl } from "#test/storage.ts";

function finishReport(provider: Pick<EngineProvider, "observations">, output: string) {
	for (const [turn, observation] of provider.observations) {
		provider.observations.set(turn, { ...observation, execution: "completed", output });
	}
}

describe("host result adoption through Fleet and PostgreSQL", () => {
	const test = it.effect.skipIf(storageDatabaseUrl === undefined);

	test("persists the observed PR number, exact head and paths before independent review", () => {
		const github = resultFixture({ after: { "changed_files": 1 }, before: { "changed_files": 1 }, files: [[{ filename: "src/one.ts" }]] });
		return withEngine({ resultQuery: github.adopt, reviewRunning: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishReport(fixture, REPORT);
				const reviewing = yield* fleet.reconcile("one");
				expect(reviewing.value.stage).toBe("reviewing");
				expect(reviewing.value.result).toEqual({ head: HEAD, kind: "change", paths: ["src/one.ts"], pr: PR, prNumber: 7 });
				const recovered = yield* fixture.restart(Effect.flatMap(Fleet, (restarted) => restarted.get("one")));
				expect(recovered.value.result).toEqual(reviewing.value.result);
				expect(fixture.reviews).toEqual([HEAD]);
			}),
		);
	});

	test("holds a reported no-change claim for terminal independent review and required checks", () => {
		const github = resultFixture();
		return withEngine({ resultQuery: github.adopt, reviewRunning: true }, (fixture) =>
			Effect.gen(function* () {
				yield* prepareWork("one");
				const fleet = yield* Fleet;
				yield* fleet.dispatch("one");
				finishReport(fixture, NO_CHANGE);
				const reviewing = yield* fleet.reconcile("one");
				expect(reviewing.value.stage).toBe("reviewing");
				expect(reviewing.value.result).toEqual({ evidence: [NO_CHANGE], head: HEAD, kind: "no-change" });
				expect(reviewing.value.outcome).toBeUndefined();
				expect(reviewing.value.checks).toBeUndefined();
				expect(reviewing.value.attempts.at(-1)?.receipt?.sessionId).not.toBe(reviewing.value.attempts[0]?.receipt?.sessionId);
				finishWorkers(fixture);
				const accepted = yield* fleet.reconcile("one");
				expect(accepted.value.stage).toBe("completed");
				expect(accepted.value.review?.head).toBe(HEAD);
				expect(accepted.value.checks?.head).toBe(HEAD);
				expect(accepted.value.outcome).toMatchObject({ evidence: [NO_CHANGE] });
				expect(fixture.merged).toHaveLength(0);
			}),
		);
	});

	for (const changedTask of [false, true]) {
		test(`no-change after main moves ${changedTask ? "rejects an edited task" : "completes for the same task revision"}`, () => {
			const github = resultFixture({ mainHead: MOVED });
			return withEngine({ resultQuery: github.adopt }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					finishReport(fixture, NO_CHANGE);
					if (changedTask) {
						fixture.editWork("one", "board-one-next");
						fixture.approveWork("one", "board-one-next");
					}
					const reconciled = yield* fleet.reconcile("one");
					if (changedTask) {
						expect(reconciled.value.stage).toBe("needs-human");
						expect(reconciled.value.decision?.reason).toBe("Board context changed while work ran");
						expect(reconciled.value.result).toBeUndefined();
						expect(fixture.reviews).toHaveLength(0);
					} else {
						expect(reconciled.value.stage).toBe("completed");
						expect(reconciled.value.result).toEqual({ evidence: [NO_CHANGE], head: HEAD, kind: "no-change" });
						expect(reconciled.value.checks?.head).toBe(HEAD);
						expect(reconciled.value.outcome).toMatchObject({ evidence: [NO_CHANGE] });
					}
					expect(fixture.merged).toHaveLength(0);
				}),
			);
		});
	}

	for (const scenario of [
		{ options: {}, output: "Missing final PR line" },
		{ options: { before: { state: "closed" } }, output: REPORT },
		{ options: { before: { head: { sha: MOVED } } }, output: REPORT },
	]) {
		test(`failed adoption requires a human decision before review: ${JSON.stringify(scenario)}`, () => {
			const github = resultFixture(scenario.options);
			return withEngine({ resultQuery: github.adopt }, (fixture) =>
				Effect.gen(function* () {
					yield* prepareWork("one");
					const fleet = yield* Fleet;
					yield* fleet.dispatch("one");
					finishReport(fixture, scenario.output);
					const blocked = yield* fleet.reconcile("one");
					expect(blocked.value.stage).toBe("needs-human");
					expect(blocked.value.result).toBeUndefined();
					expect(fixture.reviews).toHaveLength(0);
					expect(fixture.merged).toHaveLength(0);
				}),
			);
		});
	}
});
