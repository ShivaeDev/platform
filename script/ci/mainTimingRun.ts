import { readFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { shardTargetMs } from "./shardCount.ts";

export interface MainTimingRun {
	readonly count: number;
	readonly jobs: unknown;
	readonly runId: string;
	readonly sha: string;
	readonly targetMs: number;
}

export function mainTimingRun() {
	const { values } = parseArgs({
		options: {
			count: { type: "string" },
			directory: { type: "string" },
			jobs: { type: "string" },
			output: { type: "string" },
			"run-id": { type: "string" },
			sha: { type: "string" },
			"target-seconds": { type: "string" },
		},
	});
	const { count, directory, jobs, output, "run-id": runId, sha } = values;
	if (directory === undefined || jobs === undefined || output === undefined || count === undefined || runId === undefined || sha === undefined) {
		throw new Error("Provide --directory, --jobs, --output, --count, --run-id, --sha and --target-seconds");
	}
	const run: MainTimingRun = {
		count: Number(count),
		jobs: JSON.parse(readFileSync(jobs, "utf8")),
		runId,
		sha,
		targetMs: shardTargetMs(values["target-seconds"]),
	};
	return { directory, output, run };
}
