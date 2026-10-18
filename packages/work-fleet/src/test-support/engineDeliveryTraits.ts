import { Effect } from "effect";
import { ServiceUnavailable } from "@shivaedev/platform/errors/taxonomy.ts";
import { githubDelivery } from "#host/githubDelivery.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";

const result = { head: "reviewed-head", kind: "change", paths: ["src/one.ts"], pr: "https://github.com/example/repository/pull/42" } as const;
const open = { headRefOid: result.head, mergeCommit: null, mergedAt: null, state: "OPEN", url: result.pr };
const merged = { ...open, mergeCommit: { oid: "merged-revision" }, mergedAt: "2026-01-01T00:00:00Z", state: "MERGED" };
export function reviewedPullRequestIsOpen() {
	return engineConfiguration("the reviewed pull request is open for human delivery", (state) => {
		state.pullObservation = open;
		const deliveryQuery = githubDelivery(() => Effect.succeed(state.pullObservation));

		return { deliveryQuery, resultQuery: () => Effect.succeed(result) };
	});
}
export function humanDeliveryWithoutReview(status: "CLOSED" | "MERGED") {
	return engineConfiguration("a human delivers a pull request without independent review", () => {
		const observation = status === "CLOSED" ? { ...open, state: status } : merged;
		const deliveryQuery = githubDelivery(() => Effect.succeed(observation));

		return { deliveryQuery, resultQuery: () => Effect.succeed(result), sameReviewer: true };
	});
}
export function deliveryReadsCanFail(status: "CLOSED" | "OPEN") {
	return engineConfiguration("delivery reads can fail after a Board decision", (state) => {
		state.githubUnavailable = false;
		state.pullObservation = { ...open, state: status };
		const deliveryQuery = githubDelivery(() =>
			state.githubUnavailable ? Effect.fail(new ServiceUnavailable({ message: "GitHub request failed" })) : Effect.succeed(state.pullObservation),
		);

		return { deliveryQuery, resultQuery: () => Effect.succeed(result) };
	});
}
export function movedHeadReadCanFail() {
	return engineConfiguration("a moved-head refresh can fail without replacing the decision", (state) => {
		state.githubUnavailable = false;
		state.pullObservation = open;
		const deliveryQuery = githubDelivery(() => Effect.succeed(state.pullObservation));

		return {
			deliveryQuery,
			resultQuery: () =>
				state.githubUnavailable ? Effect.fail(new ServiceUnavailable({ message: "GitHub result read failed" })) : Effect.succeed(result),
		};
	});
}
