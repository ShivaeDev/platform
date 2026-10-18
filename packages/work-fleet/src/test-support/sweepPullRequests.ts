import { Effect } from "effect";
import { Forbidden } from "@shivaedev/platform/errors/taxonomy.ts";
import { conflictingPr } from "#engine/deliveryFailure.ts";
import { withFailureContext } from "#engine/failureContext.ts";
import type { FleetError } from "#errors.ts";
import type { Delivery, WorkResult } from "#policy.ts";
import { engineConfiguration } from "#test/engineConfiguration.ts";
import type { SweepPullRequest } from "#test/engineState.ts";

export function sweepPullRequests(concurrency = 6) {
	return engineConfiguration("separate pull requests expose paths, checks and human delivery", (state) => {
		const requests = new Map<string, SweepPullRequest>();
		state.sweepRequests = requests;
		const results = new Map<string, WorkResult>();
		function request(pr: string) {
			const id = pr.split("/").at(-1) ?? "";
			const value = requests.get(id);
			if (value === undefined) {
				throw new Error(`No pull request is configured for ${id}`);
			}
			return value;
		}
		return {
			backlog: 10,
			checksQuery: (result) =>
				Effect.succeed({
					evidence: ["Required checks observed"],
					failedChecks: request(result.kind === "change" ? result.pr : "").checksFailed ? ["verify"] : [],
					head: result.head,
					passed: !request(result.kind === "change" ? result.pr : "").checksFailed,
					repairPrompt: "Fix the failing verify check",
				}),
			concurrency,
			deliveryQuery: (result) =>
				Effect.suspend((): Effect.Effect<Delivery | undefined, FleetError> => {
					const value = request(result.pr);
					if (value.state === "closed") {
						return Effect.fail(withFailureContext(new Forbidden({ message: "PR closed without merging" }), { code: "pr-closed" }));
					}
					if (value.state === "merged") {
						return Effect.succeed({ head: result.head, revision: `merged-${result.head}`, url: result.pr });
					}
					return value.conflicting ? Effect.fail(conflictingPr("main-after-catalog")) : Effect.succeed(undefined);
				}),
			resultQuery: (board, observation) =>
				Effect.sync(() => {
					const key = observation.receipt.turnId;
					let result = results.get(key);
					if (result === undefined) {
						const pr = `https://example.invalid/pr/${board.workId}`;
						result = { head: `head-${board.workId}-${key}`, kind: "change", paths: request(pr).paths, pr };
						results.set(key, result);
					}
					return result;
				}),
		};
	});
}
