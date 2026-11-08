import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Result } from "effect";
import { availableJobDurations } from "#ci/adapters/availableJobDurations.ts";
import { CiFailure } from "#ci/Failure.ts";
import { type MainTimingRun, mainTimingRun, timingReports } from "#ci/mainTimingRun.ts";
import { wallTimeShardCount } from "#ci/shardCount.ts";
import { decodeJunitTimingReport, decodeTimingSnapshot } from "#ci/timings.ts";

export const mergeTestTimings = Effect.fn("CI.mergeTestTimings")(function* (reports: readonly string[], run: MainTimingRun) {
	const durations = yield* availableJobDurations(run.jobs, /^tests \(\d+\)$/u, run.count);
	if (durations === undefined) {
		return { runId: run.runId, sha: run.sha, timings: [] };
	}
	if (reports.length !== run.count || run.count < 1) {
		return yield* new CiFailure({ message: "Test timing reports must cover every shard" });
	}
	const timings = (yield* Effect.fromResult(Result.all(reports.map(decodeJunitTimingReport)))).flat();
	if (timings.length === 0) {
		return yield* new CiFailure({ message: "Test timing reports are empty" });
	}
	return yield* Effect.fromResult(
		decodeTimingSnapshot({
			runId: run.runId,
			sha: run.sha,
			shardCount: yield* Effect.fromResult(wallTimeShardCount(durations, run.targetMs)),
			timings: timings.sort((a, b) => a.name.localeCompare(b.name, "en")),
		}),
	);
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { directory, output, run } = yield* mainTimingRun();
			const merged = yield* mergeTestTimings(yield* timingReports(directory, "tests.junit.xml"), run);
			yield* fs.writeFileString(output, `${JSON.stringify(merged, null, 2)}\n`);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}
