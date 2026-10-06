import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { decodeTimingSnapshot, decodeVitestTimingReport } from "./timings.ts";

export function mergeTestTimings(reports: readonly string[], count: number, runId: string, sha: string) {
	if (reports.length !== count || count < 1) {
		throw new Error("Test timing reports must cover every shard");
	}
	const timings = reports.flatMap(decodeVitestTimingReport);
	if (timings.length === 0) {
		throw new Error("Test timing reports are empty");
	}
	return decodeTimingSnapshot({ runId, sha, timings: timings.sort((a, b) => a.name.localeCompare(b.name, "en")) });
}

if (import.meta.main) {
	const { values } = parseArgs({
		options: {
			count: { type: "string" },
			directory: { type: "string" },
			output: { type: "string" },
			"run-id": { type: "string" },
			sha: { type: "string" },
		},
	});
	if (
		values.directory === undefined
		|| values.output === undefined
		|| values.count === undefined
		|| values["run-id"] === undefined
		|| values.sha === undefined
	) {
		throw new Error("Provide --directory, --output, --count, --run-id and --sha");
	}
	const reports = globSync("**/results.json", { cwd: values.directory }).map((path) => readFileSync(join(values.directory ?? "", path), "utf8"));
	writeFileSync(values.output, `${JSON.stringify(mergeTestTimings(reports, Number(values.count), values["run-id"], values.sha), null, 2)}\n`);
}
