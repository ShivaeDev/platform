import { ConfigProvider, Effect } from "effect";
import { generate } from "#generate.ts";
import type { GenerateFailed, GenerateReport } from "#report.ts";

export interface GenerateOutcome {
	readonly files: Readonly<Record<string, string>>;
	readonly problems: readonly string[];
	readonly programBuilt: boolean;
	readonly result: "failed" | "succeeded";
}

function outcomeOf(report: GenerateReport, failed: GenerateFailed | undefined): GenerateOutcome {
	return {
		files: Object.fromEntries([...report.modules, ...report.lists].map(({ output, status }) => [output, status])),
		problems: failed?.problems ?? [],
		programBuilt: report.programBuilt,
		result: failed === undefined ? "succeeded" : "failed",
	};
}

// Only the story's lock file, so the lock is taken even on CI, where a set CI variable skips it.
export function onlyTheStoryLock(lock: string) {
	return Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { "HEAVY_PROCESS_LOCK": lock } }));
}

export function generateIn(root: string, lock: string, check: boolean) {
	return generate(root, { check }).pipe(
		Effect.map((report) => outcomeOf(report, undefined)),
		Effect.catchTag("GenerateFailed", (failed) => Effect.succeed(outcomeOf(failed.report, failed))),
		onlyTheStoryLock(lock),
	);
}
