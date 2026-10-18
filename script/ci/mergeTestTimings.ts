import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type MainTimingRun, mainTimingRun } from "./mainTimingRun.ts";
import { jobDurations, wallTimeShardCount } from "./shardCount.ts";
import { decodeTimingSnapshot, decodeVitestTimingReport } from "./timings.ts";

export function mergeTestTimings(reports: readonly string[], run: MainTimingRun) {
	if (reports.length !== run.count || run.count < 1) {
		throw new Error("Test timing reports must cover every shard");
	}
	const timings = reports.flatMap(decodeVitestTimingReport);
	if (timings.length === 0) {
		throw new Error("Test timing reports are empty");
	}
	return decodeTimingSnapshot({
		runId: run.runId,
		sha: run.sha,
		shardCount: wallTimeShardCount(jobDurations(run.jobs, /^tests \(\d+\)$/u, run.count), run.targetMs),
		timings: timings.sort((a, b) => a.name.localeCompare(b.name, "en")),
	});
}

if (import.meta.main) {
	const { directory, output, run } = mainTimingRun();
	const reports = globSync("**/results.json", { cwd: directory }).map((path) => readFileSync(join(directory, path), "utf8"));
	writeFileSync(output, `${JSON.stringify(mergeTestTimings(reports, run), null, 2)}\n`);
}
