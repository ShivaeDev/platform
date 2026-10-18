import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type MainTimingRun, mainTimingRun } from "./mainTimingRun.ts";
import { consumerShardMs, jobDurations, wallTimeShardCount } from "./shardCount.ts";
import { decodeTimingSnapshot, mergeConsumerTimingReports } from "./timings.ts";

export function mergeConsumerTimings(reports: readonly unknown[], run: MainTimingRun) {
	const snapshot = mergeConsumerTimingReports(reports, run.runId, run.sha);
	const [buildMs = 0] = jobDurations(run.jobs, /^build$/u, 1);
	const consumers = jobDurations(run.jobs, /^packed consumers \(\d+\)$/u, run.count);
	return decodeTimingSnapshot({ ...snapshot, shardCount: wallTimeShardCount(consumers, consumerShardMs(run.targetMs, buildMs)) });
}

if (import.meta.main) {
	const { directory, output, run } = mainTimingRun();
	const reports: unknown[] = globSync("**/consumers.json", { cwd: directory }).map((path) => JSON.parse(readFileSync(join(directory, path), "utf8")));
	writeFileSync(output, `${JSON.stringify(mergeConsumerTimings(reports, run), null, 2)}\n`);
}
