import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { testJobDurations, wallTimeShardCount } from "./shardCount.ts";
import { decodeTimingSnapshot, decodeVitestTimingReport } from "./timings.ts";

export function mergeTestTimings(reports: readonly string[], jobs: unknown, count: number, runId: string, sha: string) {
	if (reports.length !== count || count < 1) {
		throw new Error("Test timing reports must cover every shard");
	}
	const timings = reports.flatMap(decodeVitestTimingReport);
	if (timings.length === 0) {
		throw new Error("Test timing reports are empty");
	}
	return decodeTimingSnapshot({
		runId,
		sha,
		shardCount: wallTimeShardCount(testJobDurations(jobs, count)),
		timings: timings.sort((a, b) => a.name.localeCompare(b.name, "en")),
	});
}

if (import.meta.main) {
	const { values } = parseArgs({
		options: {
			count: { type: "string" },
			directory: { type: "string" },
			jobs: { type: "string" },
			output: { type: "string" },
			"run-id": { type: "string" },
			sha: { type: "string" },
		},
	});
	if (
		values.directory === undefined
		|| values.jobs === undefined
		|| values.output === undefined
		|| values.count === undefined
		|| values["run-id"] === undefined
		|| values.sha === undefined
	) {
		throw new Error("Provide --directory, --jobs, --output, --count, --run-id and --sha");
	}
	const reports = globSync("**/results.json", { cwd: values.directory }).map((path) => readFileSync(join(values.directory ?? "", path), "utf8"));
	const jobs: unknown = JSON.parse(readFileSync(values.jobs, "utf8"));
	const snapshot = mergeTestTimings(reports, jobs, Number(values.count), values["run-id"], values.sha);
	writeFileSync(values.output, `${JSON.stringify(snapshot, null, 2)}\n`);
}
