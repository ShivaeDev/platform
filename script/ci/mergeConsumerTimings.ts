import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, FileSystem, Schema } from "effect";
import { availableJobDurations } from "#ci/availableJobDurations.ts";
import { type MainTimingRun, mainTimingRun, timingReports } from "#ci/mainTimingRun.ts";
import { consumerShardMs, wallTimeShardCount } from "#ci/shardCount.ts";
import { decodeTimingSnapshot, mergeConsumerTimingReports } from "#ci/timings.ts";

export const mergeConsumerTimings = Effect.fn("CI.mergeConsumerTimings")(function* (reports: readonly unknown[], run: MainTimingRun) {
	const build = yield* availableJobDurations(run.jobs, /^build$/u, 1);
	const consumers = yield* availableJobDurations(run.jobs, /^packed consumers \(\d+\)$/u, run.count);
	if (build === undefined || consumers === undefined) {
		return { runId: run.runId, sha: run.sha, timings: [] };
	}
	const snapshot = yield* Effect.fromResult(mergeConsumerTimingReports(reports, run.runId, run.sha));
	const [buildMs = 0] = build;
	const shardCount = yield* Effect.fromResult(wallTimeShardCount(consumers, consumerShardMs(run.targetMs, buildMs)));
	return yield* Effect.fromResult(decodeTimingSnapshot({ ...snapshot, shardCount }));
});

if (import.meta.main) {
	NodeRuntime.runMain(
		Effect.gen(function* () {
			const fs = yield* FileSystem.FileSystem;
			const { directory, output, run } = yield* mainTimingRun();
			const decode = Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown));
			const reports = yield* Effect.forEach(yield* timingReports(directory, "consumers.json"), (report) => decode(report));
			yield* fs.writeFileString(output, `${JSON.stringify(yield* mergeConsumerTimings(reports, run), null, 2)}\n`);
		}).pipe(Effect.provide(NodeServices.layer)),
	);
}
