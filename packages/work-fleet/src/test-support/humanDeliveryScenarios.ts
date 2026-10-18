import { Effect } from "effect";
import { githubDelivery } from "#host/githubDelivery.ts";
import { engineScenario } from "#test/engineScenario.ts";

const result = { head: "reviewed-head", kind: "change", paths: ["src/one.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
const open = { headRefOid: result.head, mergeCommit: null, mergedAt: null, state: "OPEN", url: result.pr };
const merged = { ...open, mergeCommit: { oid: "merged-revision" }, mergedAt: "2026-01-01T00:00:00Z", state: "MERGED" };

export function reviewedPullRequestIsOpen() {
	return engineScenario("the reviewed pull request is open for human delivery", () => {
		let observation: unknown = open;
		const deliveryQuery = githubDelivery(() => Effect.succeed(observation));
		return {
			context: {
				deliveryQuery,
				get observation() {
					return observation;
				},
				set observation(value: typeof observation) {
					observation = value;
				},
			},
			options: { deliveryQuery, resultQuery: () => Effect.succeed(result) },
		};
	});
}
export function humanDeliveryWithoutReview(state: "CLOSED" | "MERGED") {
	return engineScenario("a human delivers a pull request without independent review", () => {
		const observation = state === "CLOSED" ? { ...open, state } : merged;
		const deliveryQuery = githubDelivery(() => Effect.succeed(observation));
		return {
			context: {
				deliveryQuery,
				observation,
			},
			options: { deliveryQuery, resultQuery: () => Effect.succeed(result), sameReviewer: true },
		};
	});
}
