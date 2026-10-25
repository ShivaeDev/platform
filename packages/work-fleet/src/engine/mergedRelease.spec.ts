import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { backlog, executing } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { checksWithoutRepair, githubPullRequest } from "#test/engineTraits.ts";
import { HEAD, MOVED, PR, REPORT } from "#test/githubResult.ts";
import { QUESTION } from "#test/workerQuestion.ts";

for (const scenario of ["worker question", "failing check", "changed head"] as const) {
	engine.it(
		`a human merge releases an adopted PR with a ${scenario} after one reconcile`,
		[githubPullRequest({ failed: scenario === "failing check" }), checksWithoutRepair()],
		function* ({
			fleet,
			prepareWork,
			workerReports,
			turnReports,
			respond,
			mergePullRequest,
			movePullRequestHead,
			reserveForeign,
			acknowledgements,
			foreignReservations,
			mergedHeads,
		}) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			workerReports(REPORT);
			let waiting = yield* fleet.reconcile("one");
			if (scenario === "worker question") {
				const decisionId = waiting.value.decision?.id ?? (yield* Effect.die("Missing delivery decision"));
				yield* fleet.resolve("one", decisionId, respond(decisionId, "retry"));
				yield* fleet.reconcile("one");
				yield* turnReports(yield* fleet.get("one"), `FLEET_QUESTION: ${QUESTION}`);
				waiting = yield* fleet.reconcile("one");
			}
			if (scenario === "failing check") {
				expect(waiting.value.review?.verdict).toBe("approved");
				expect(waiting.value.checks?.passed).toBe(false);
			}
			expect(waiting.value.step).toBe("waiting");
			expect(executing(waiting.value)).toBe(false);
			const published = waiting.value.decision?.published ?? (yield* Effect.die("Missing published decision"));
			mergePullRequest();
			movePullRequestHead(scenario === "changed head" ? MOVED : HEAD);
			yield* reserveForeign(PR);
			const released = yield* fleet.reconcile("one");
			expect(released.value.step).toBe("released");
			expect(released.value.releaseReason).toBe(
				`PR #7 merged by a human at ${scenario === "changed head" ? MOVED : HEAD}; Fleet review covered ${HEAD}`,
			);
			expect(released.value.outcome).toBeUndefined();
			expect(released.value.decision).toBeUndefined();
			expect(released.value.supersededDecisions).toContainEqual({
				boardAcknowledged: true,
				published,
				supersededAt: expect.any(Number),
			});
			expect(acknowledgements()).toContainEqual({
				decision: published,
				disposition: "superseded",
				recordedAt: expect.any(Number),
			});
			expect(backlog(released.value)).toBe(false);
			expect(yield* foreignReservations()).toEqual([]);
			expect((yield* fleet.reconcile("one")).version).toBe(released.version);
			expect(mergedHeads()).toEqual([]);
		},
	);
}
