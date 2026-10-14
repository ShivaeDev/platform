import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { Fleet } from "#fleet.ts";
import { backlog, executing } from "#model.ts";
import { type EngineFixture, withEngine } from "#test/engine.ts";
import { HEAD, MOVED, PR } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresTests } from "#test/postgres.ts";
import { reportWorker } from "#test/reportWorker.ts";
import { askWorker } from "#test/workerQuestion.ts";

const test = postgresTests("test");

for (const scenario of ["worker question", "failing check", "changed head"] as const) {
	test(`a human merge releases an adopted PR with a ${scenario} after one reconcile`, () => mergedRelease(scenario));
}

function mergedRelease(scenario: "worker question" | "failing check" | "changed head") {
	return Effect.scoped(
		Effect.gen(function* () {
			const github = yield* mergedReviewGithub();
			github.state.failed = scenario === "failing check";
			yield* withEngine(
				{ ...github, checksQuery: (result) => github.checksQuery(result).pipe(Effect.map((checks) => ({ ...checks, repairPrompt: undefined }))) },
				(fixture) =>
					Effect.gen(function* () {
						const waiting = yield* prepareWaiting(fixture, scenario);
						const fleet = yield* Fleet;
						expect(waiting.value.stage).toBe("needs-human");
						expect(executing(waiting.value)).toBe(false);
						const published = waiting.value.decision?.published ?? (yield* Effect.die("Missing published decision"));
						github.state.status = "MERGED";
						github.state.head = scenario === "changed head" ? MOVED : HEAD;
						yield* fixture.foreign(PR);
						const released = yield* fleet.reconcile("one");
						expect(released.value.stage).toBe("released");
						expect(released.value.releaseReason).toBe(
							`PR #7 merged by a human at ${github.state.head}; Fleet review covered ${waiting.value.review?.head ?? "nothing"}`,
						);
						expect(released.value.outcome).toBeUndefined();
						expect(released.value.decision).toBeUndefined();
						expect(released.value.supersededDecisions).toContainEqual({
							boardAcknowledged: true,
							published,
							supersededAt: expect.any(Number),
						});
						expect(fixture.acknowledgements).toContainEqual({
							decision: published,
							disposition: "superseded",
							recordedAt: expect.any(Number),
						});
						expect(backlog(released.value)).toBe(false);
						expect(yield* fixture.foreignReservations()).toEqual([]);
						expect((yield* fleet.reconcile("one")).version).toBe(released.version);
						expect(fixture.merged).toEqual([]);
					}),
			);
		}),
	);
}

const prepareWaiting = Effect.fnUntraced(function* (fixture: EngineFixture, scenario: "worker question" | "failing check" | "changed head") {
	yield* reportWorker(fixture);
	const fleet = yield* Fleet;
	let waiting = yield* fleet.reconcile("one");
	if (scenario === "worker question") {
		const decisionId = waiting.value.decision?.id ?? "missing";
		yield* fleet.resolve("one", decisionId, fixture.respond(decisionId, "retry"));
		yield* fleet.reconcile("one");
		waiting = (yield* askWorker(fixture)).stopped;
	}
	if (scenario === "failing check") {
		expect(waiting.value.review?.verdict).toBe("approved");
		expect(waiting.value.checks?.passed).toBe(false);
	}

	return waiting;
});
