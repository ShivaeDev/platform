import { mkdir, truncate, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import { reportIdentity } from "#board/reportIdentity.ts";
import { REPORT_LIMITS } from "#reportLimits.ts";
import { type EngineStory, running } from "#test/engineState.ts";

export function reportFailureVerbs(state: EngineStory, tell: (line: string) => void) {
	function failure() {
		if (state.recovery.reportFailure === undefined) {
			throw new Error("No report file failure is configured");
		}
		return state.recovery.reportFailure;
	}
	return {
		oversizeReportPayload: () =>
			Effect.gen(function* () {
				tell("the saved report payload exceeds its size limit");
				const [observation] = running(state).fixture.observations.values();
				if (observation === undefined) {
					return yield* Effect.die("Missing report worker");
				}
				const { itemId } = reportIdentity(failure().work, observation.receipt);
				failure().path = `.fleet-reports/${itemId}.json`;
				yield* Effect.promise(async () => {
					await mkdir(join(state.root, ".fleet-reports"));
					await writeFile(join(state.root, failure().path), "");
					await truncate(join(state.root, failure().path), REPORT_LIMITS.attachmentBytes * 2 + 512 * 1024 + 1);
				});
			}),
		reportFailurePath: () => failure().path,
	};
}
