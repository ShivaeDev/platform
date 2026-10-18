import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import { backlog } from "#model.ts";
import { deliveryReadsCanFail, movedHeadReadCanFail } from "#test/engineDeliveryTraits.ts";
import { engine } from "#test/engineStory.ts";
import { configured } from "#test/engineTraits.ts";

const result = { head: "reviewed-head", kind: "change", paths: ["src/one.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
for (const owner of ["orchestrator", "automation"] as const) {
	engine.it(
		`delivery observation failures wait on ${owner}`,
		[
			configured({
				deliveryQuery: () =>
					Effect.fail(
						withFailureContext(new ServiceUnavailable({ message: "Delivery unavailable" }), {
							attentionOwner: owner === "automation" ? owner : undefined,
						}),
					),
			}),
		],
		function* ({ fleet, prepareWork, finishWorkers, restart, advanceTime, currentTime }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const retrying = yield* fleet.reconcile("one");
			expect(retrying.value.attentionOwner).toBe("automation");
			expect(retrying.value.decision).toBeUndefined();
			for (let count = 0; count < 4; count += 1) {
				const current = yield* fleet.get("one");
				const retry = current.value.integrationRetry ?? current.value.attempts.at(-1)?.readRetry;
				if (retry === undefined) {
					break;
				}
				advanceTime(retry.retryAt - currentTime());
				yield* restart();
				yield* fleet.reconcile("one");
			}
			const waiting = yield* fleet.get("one");
			expect(waiting.value.attentionOwner).toBe(owner);
			expect(waiting.value.decision?.attentionOwner).toBe(owner);
			yield* restart();
			expect((yield* fleet.get("one")).value.attentionOwner).toBe(owner);
		},
	);
}
for (const state of ["OPEN", "CLOSED"] as const) {
	{
		const setup = deliveryReadsCanFail(state);
		engine.it(
			`transient delivery failure preserves the ${state} PR's Board decision across restart`,
			[setup],
			function* ({
				fleet,
				prepareWork,
				finishWorkers,
				restart,
				githubBecomesUnavailable,
				schedule,
				githubRecovers,
				reopenPullRequest,
				mergePullRequest,
				reviewedHeads,
				mergedHeads,
			}) {
				yield* prepareWork("one");
				yield* fleet.dispatch("one");
				finishWorkers();
				const current = yield* fleet.reconcile("one");
				expect(current.value.decision?.published).toBeDefined();
				expect(current.value.decision?.reason).toContain(state === "OPEN" ? "ready to merge" : "closed without merging");
				githubBecomesUnavailable();
				yield* restart();
				yield* schedule();
				expect(yield* fleet.get("one")).toEqual(current);
				expect(yield* fleet.reconcile("one")).toEqual(current);
				expect(backlog(current.value)).toBe(true);
				githubRecovers();
				reopenPullRequest();
				const recovered = yield* fleet.reconcile("one");
				expect(recovered.value.decision?.reason).toBe("Reviewed PR is ready to merge");
				mergePullRequest(undefined, "merge-revision");
				yield* restart();
				yield* schedule();
				expect((yield* fleet.get("one")).value.outcome).toEqual({ head: result.head, revision: "merge-revision", url: result.pr });
				expect(reviewedHeads()).toHaveLength(1);
				expect(mergedHeads()).toEqual([]);
			},
		);
	}
}
{
	const setup = movedHeadReadCanFail();
	engine.it(
		"an outage while refreshing a moved PR head preserves the existing decision",
		[setup],
		function* ({ fleet, prepareWork, finishWorkers, restart, githubBecomesUnavailable, movePullRequestHead, schedule, publishedDecisions }) {
			yield* prepareWork("one");
			yield* fleet.dispatch("one");
			finishWorkers();
			const ready = (yield* fleet.reconcile("one")).value;
			expect(ready.decision?.code).toBe("reviewed-pr-ready");
			githubBecomesUnavailable();
			movePullRequestHead("moved-head");
			yield* restart();
			yield* schedule();
			const waiting = (yield* fleet.get("one")).value;
			expect(waiting.decision).toEqual(ready.decision);
			expect(waiting.result).toEqual(ready.result);
			expect(waiting.mergeReadyHead).toBeUndefined();
			expect(publishedDecisions()).toHaveLength(1);
			yield* restart();
			yield* schedule();
			expect((yield* fleet.get("one")).value.decision).toEqual(ready.decision);
			expect(publishedDecisions()).toHaveLength(1);
		},
	);
}
