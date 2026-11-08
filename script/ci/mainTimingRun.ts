import { basename, join } from "node:path";
import { Effect, FileSystem, Schema } from "effect";
import { parsedArguments } from "#adapters/parsedArguments.ts";
import { CiFailure } from "#ci/Failure.ts";
import { shardTargetMs } from "#ci/shardCount.ts";

export interface MainTimingRun {
	readonly count: number;
	readonly jobs: unknown;
	readonly runId: string;
	readonly sha: string;
	readonly targetMs: number;
}

export const mainTimingRun = Effect.fn("CI.mainTimingRun")(function* () {
	const fs = yield* FileSystem.FileSystem;
	const { values } = yield* parsedArguments({
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
		return yield* new CiFailure({ message: "Provide --directory, --jobs, --output, --count, --run-id, --sha and --target-seconds" });
	}
	const run: MainTimingRun = {
		count: Number(count),
		jobs: yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Schema.Unknown))(yield* fs.readFileString(jobs)),
		runId,
		sha,
		targetMs: yield* Effect.fromResult(shardTargetMs(values["target-seconds"])),
	};
	return { directory, output, run };
});

export const timingReports = Effect.fn("CI.timingReports")(function* (directory: string, name: string) {
	const fs = yield* FileSystem.FileSystem;
	if (!(yield* fs.exists(directory))) {
		return [];
	}
	const paths = yield* fs.readDirectory(directory, { recursive: true });
	return yield* Effect.forEach(
		paths.filter((path) => basename(path) === name),
		(path) => fs.readFileString(join(directory, path)),
	);
});
