import { Effect } from "effect";
import type { FleetRecord } from "#model.ts";
import { until } from "#test/cloudRestart.ts";
import { HEAD, REPORT } from "#test/githubResult.ts";
import type { HostStoryEngine } from "#test/HostStoryEngine.ts";
import { hostProviderVerbs } from "#test/hostProviderVerbs.ts";

export function watchReview(engine: HostStoryEngine, tell: (line: string) => void) {
	return {
		finishReviewedWorker: (record: FleetRecord, head = HEAD) => {
			if (engine.pullRequest === undefined) {
				throw new Error("Configure a pull request before finishing its worker");
			}
			engine.pullRequest.state.head = head;
			hostProviderVerbs(engine, tell).finishTurn(record, REPORT.replace(HEAD, head));
		},
		reviewReady: (workId: string) =>
			Effect.gen(function* () {
				tell(`reconcile ${workId} until its review is ready`);
				yield* until(() =>
					engine.running.client("fleet.reconcile", { workId }).pipe(Effect.map((record) => record.decision?.code === "reviewed-pr-ready")),
				);
				return yield* engine.running.client("fleet.get", { workId });
			}),
	};
}
