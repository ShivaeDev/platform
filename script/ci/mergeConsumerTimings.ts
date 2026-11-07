import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { availableJobDurations } from "#ci/adapters/availableJobDurations.ts";
import { type MainTimingRun, mainTimingRun } from "#ci/mainTimingRun.ts";
import { consumerShardMs, wallTimeShardCount } from "#ci/shardCount.ts";
import { decodeTimingSnapshot, mergeConsumerTimingReports } from "#ci/timings.ts";

export function mergeConsumerTimings(reports: readonly unknown[], run: MainTimingRun) {
	const build = availableJobDurations(run.jobs, /^build$/u, 1);
	const consumers = availableJobDurations(run.jobs, /^packed consumers \(\d+\)$/u, run.count);
	if (build === undefined || consumers === undefined) {
		return { runId: run.runId, sha: run.sha, timings: [] };
	}
	const snapshot = mergeConsumerTimingReports(reports, run.runId, run.sha);
	const [buildMs = 0] = build;
	return decodeTimingSnapshot({ ...snapshot, shardCount: wallTimeShardCount(consumers, consumerShardMs(run.targetMs, buildMs)) });
}

if (import.meta.main) {
	const { directory, output, run } = mainTimingRun();
	const reports: unknown[] = globSync("**/consumers.json", { cwd: directory }).map((path) => JSON.parse(readFileSync(join(directory, path), "utf8")));
	writeFileSync(output, `${JSON.stringify(mergeConsumerTimings(reports, run), null, 2)}\n`);
}
