import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { backlog, executing } from "#model.ts";
import { engine } from "#test/engineStory.ts";
import { checksWithoutRepair, githubPullRequest } from "#test/engineTraits.ts";
import { HEAD, MOVED, PR } from "#test/githubResult.ts";

for (const scenario of ["worker question", "failing check", "changed head"] as const) {
	engine.it(
		`a human merge releases an adopted PR with a ${scenario} after one reconcile`,
		[githubPullRequest({ failed: scenario === "failing check" }), checksWithoutRepair()],
		function* ({ fixture, fleet, pullRequest, waitingForHuman }) {
			const github = pullRequest();
			const waiting = yield* waitingForHuman(scenario);
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
		},
	);
}
