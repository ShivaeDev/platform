import { Deferred, Effect } from "effect";
import type { EngineStory } from "#test/engineState.ts";

export function engineSweepVerbs(state: EngineStory, tell: (line: string) => void) {
	function request(workId: string) {
		const value = state.sweepRequests?.get(workId);
		if (value === undefined) {
			throw new Error(`No pull request is configured for ${workId}`);
		}
		return value;
	}
	return {
		configureSweepPr: (workId: string, paths: readonly string[]) => {
			if (state.sweepRequests === undefined) {
				throw new Error("No sweep pull request provider is configured");
			}
			state.sweepRequests.set(workId, { paths, state: "open" });
			tell(`the pull request for ${workId} changes ${paths.join(", ")}`);
		},
		observeSweepPr: (workId: string, status: "open" | "closed" | "merged") => {
			request(workId).state = status;
			tell(`GitHub reports ${workId} ${status}`);
		},
		publishedMergeReadiness: () => {
			if (state.readinessPublications === undefined) {
				throw new Error("No readiness publication observer is configured");
			}
			return [...state.readinessPublications];
		},
		resumeSweepReadinessWrite: () =>
			Effect.suspend(() => {
				if (state.sweepReadiness === undefined) {
					throw new Error("No readiness write gate is configured");
				}
				tell("allow the merge readiness write to reach PostgreSQL");
				return Deferred.succeed(state.sweepReadiness.resume, undefined);
			}),
		sweepChecksFail: (workId: string, failed: boolean) => {
			request(workId).checksFailed = failed;
			tell(`GitHub reports checks ${failed ? "failing" : "passing"} for ${workId}`);
		},
		sweepConflicts: (workId: string, conflicting: boolean) => {
			request(workId).conflicting = conflicting;
			tell(`GitHub reports ${workId} ${conflicting ? "conflicting" : "mergeable"}`);
		},
		waitForSweepReadinessWrite: () =>
			Effect.suspend(() => {
				if (state.sweepReadiness === undefined) {
					throw new Error("No readiness write gate is configured");
				}
				tell("wait until the reviewed PR is about to commit merge readiness");
				return Deferred.await(state.sweepReadiness.entered);
			}),
	};
}
