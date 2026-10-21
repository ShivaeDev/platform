import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { statusMarkdown } from "#board/statusMarkdown.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { type EngineFixture, prepareWork, withEngine } from "#test/engine.ts";
import { HEAD, REPORT } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

export const githubReadRetry = Effect.fn("Test.githubReadRetry")(function* (failures: number) {
	let now = 100;
	const github = yield* mergedReviewGithub();
	return yield* withEngine({ ...github, now: () => now, reviewRunning: true }, (fixture) =>
		Effect.gen(function* () {
			const fleet = yield* Fleet;
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			for (const [turn, observation] of fixture.observations) {
				fixture.observations.set(turn, { ...observation, execution: "completed", output: REPORT });
			}
			github.state.unavailableReads = failures;
			const waiting = (yield* fleet.reconcile("one")).value;
			expect(waiting.step).toBe("adopting");
			expect(waiting.decision).toBeUndefined();
			expect(waiting.attentionOwner).toBe("automation");
			expect(waiting.integrationRetry).toMatchObject({ failures: 1, retryAt: 30_100 });
			expect(statusMarkdown([waiting])).toContain(waiting.blocker);
			const reads = github.requests.length;
			now = 30_099;
			yield* fixture.restart(cycle);
			expect(github.requests).toHaveLength(reads);
			yield* retryGithubReads(fixture, failures, (time) => {
				now = time;
			});
			const result = (yield* fleet.get("one")).value;
			yield* verifyReadRetryOutcome(fixture, result, failures);
			expect(fixture.starts.filter((start) => start.access !== "read-only")).toHaveLength(1);
		}),
	);
}, Effect.scoped);

const retryGithubReads = Effect.fn("Test.retryGithubReads")(function* (fixture: EngineFixture, failures: number, setTime: (time: number) => void) {
	const fleet = yield* Fleet;
	const attempts = failures === 1 ? 2 : failures;
	for (let attempt = 2; attempt <= attempts; attempt += 1) {
		const retry = (yield* fleet.get("one")).value.integrationRetry;
		expect(retry).toBeDefined();
		const now = retry?.retryAt ?? 0;
		setTime(now);
		yield* fixture.restart(cycle);
		const current = (yield* fleet.get("one")).value;
		if (attempt < failures) {
			expect(current.integrationRetry).toMatchObject({ failures: attempt, retryAt: now + 30_000 * 2 ** (attempt - 1) });
			expect(current.decision).toBeUndefined();
		}
	}
});

const verifyReadRetryOutcome = Effect.fn("Test.verifyReadRetryOutcome")(function* (fixture: EngineFixture, result: FleetRecord, failures: number) {
	const fleet = yield* Fleet;
	if (failures === 1) {
		expect(result.step).toBe("reviewing");
		expect(result.result?.head).toBe(HEAD);
		expect(result.integrationRetry).toBeUndefined();
		expect(result.blocker).toBeUndefined();
		expect(result.attentionOwner).toBeUndefined();
		expect(result.decision).toBeUndefined();
		expect(fixture.decisions).toHaveLength(0);
	} else {
		expect(result.step).toBe("waiting");
		expect(result.decision?.reason).toContain("read failure after 5 attempts");
		expect(result.decisionPublished).toBe(true);
		expect(fixture.decisions).toHaveLength(1);
		yield* fixture.restart(cycle);
		expect((yield* fleet.get("one")).value.decision).toEqual(result.decision);
		expect(fixture.decisions).toHaveLength(1);
	}
});
