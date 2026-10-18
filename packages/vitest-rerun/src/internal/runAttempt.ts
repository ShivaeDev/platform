import { Config, Console, Effect, FileSystem, Schema } from "effect";
import type { CliOptions, Vitest } from "vitest/node";
import * as VitestNode from "vitest/node";
import { failWith } from "#error.ts";
import { writeFlakyTests } from "#flakyTests.ts";
import { RerunJunitReporter } from "#internal/junit.ts";
import { mergeAttempt } from "#internal/mergeAttempt.ts";
import { attemptPaths, reportPaths } from "#internal/reportPaths.ts";
import { failedFiles, readSnapshot, type Snapshot, saveSnapshot, tests } from "#internal/snapshot.ts";
import { TimedJsonReporter } from "#internal/TimedJsonReporter.ts";

export interface Attempt {
	readonly attempt: number;
	readonly outputDir: string;
	readonly vitestArgs: readonly string[];
}

const CoverageReport = Schema.Struct({ coverageMap: Schema.optional(Schema.Unknown) });
const decodeCoverage = Schema.decodeUnknownEffect(Schema.fromJsonString(CoverageReport));

function promise<A>(message: string, run: () => Promise<A>) {
	return Effect.tryPromise({ catch: failWith(message), try: run });
}

function start(options: CliOptions, reports: { json: string; junit: string }, cacheDir: string | undefined) {
	return Effect.acquireRelease(
		promise("Vitest could not start", () =>
			VitestNode.createVitest(
				{
					...options,
					reporters: ["default", new TimedJsonReporter({ outputFile: reports.json }), new RerunJunitReporter(reports.junit)],
					retry: 0,
					watch: false,
				},
				cacheDir === undefined ? {} : { cacheDir },
			),
		),
		(vitest) => Effect.promise(() => vitest.close()),
	);
}

const failedSpecifications = Effect.fn("VitestRerun.failedSpecifications")(function* (vitest: Vitest, previous: Snapshot, json: string) {
	const failed = new Set(yield* failedFiles(json));
	yield* promise("Vitest could not prepare the rerun", () => vitest.standalone());
	const specifications = yield* promise("Vitest could not list test files", () => vitest.globTestSpecifications());
	return specifications.flatMap((spec) => {
		const file = previous.files.find((item) => item.id === spec.taskId && failed.has(spec.moduleId) && item.result?.state === "fail");
		if (file === undefined) {
			return [];
		}
		const runnable = tests(file.tasks).filter((test) => !["pass", "skip", "todo"].includes(test.result?.state ?? test.mode));
		return [spec.project.createSpecification(spec.moduleId, file.tasks.length === 0 ? {} : { testIds: runnable.map((test) => test.id) }, spec.pool)];
	});
});

const mergeCoverage = Effect.fn("VitestRerun.mergeCoverage")(function* (vitest: Vitest, outputDir: string, attempt: number) {
	const fs = yield* FileSystem.FileSystem;
	const maps: unknown[] = [];
	for (let earlier = 1; earlier <= attempt; earlier += 1) {
		const { coverageMap } = yield* decodeCoverage(yield* fs.readFileString(attemptPaths(outputDir, earlier).json));
		if (coverageMap !== undefined) {
			maps.push(coverageMap);
		}
	}
	const provider = yield* promise("Vitest could not load its coverage provider", () => vitest.createCoverageProvider());
	yield* promise("Vitest could not merge coverage", async () => provider?.mergeReports?.(maps));
});

const summaryLine = Effect.fn("VitestRerun.summaryLine")(function* (line: string) {
	const fs = yield* FileSystem.FileSystem;
	const summary = yield* Config.String("GITHUB_STEP_SUMMARY").pipe(Config.withDefault(""));
	yield* Console.log(line);
	if (summary !== "") {
		yield* fs.writeFileString(summary, `${line}\n`, { flag: "a" });
	}
});

const rerunFailed = Effect.fn("VitestRerun.rerunFailed")(function* (vitest: Vitest, { attempt, outputDir }: Attempt) {
	const previous = yield* readSnapshot(attemptPaths(outputDir, attempt - 1).snapshot);
	const final = reportPaths(outputDir);
	const specifications = yield* failedSpecifications(vitest, previous, final.json);
	if (specifications.length === 0) {
		return yield* Effect.fail(failWith("No failed specifications found for the fresh rerun")(undefined));
	}
	yield* promise("Vitest could not rerun the failed tests", () => vitest.runTestSpecifications(specifications));
	const lines: string[] = [];
	const merged = mergeAttempt(previous, vitest.state.getFiles(), vitest.config.root, (line) => lines.push(line));
	for (const file of merged.files) {
		vitest.state.collectFiles(vitest.getProjectByName(file.projectName ?? ""), [file]);
	}
	yield* Effect.forEach(lines, summaryLine);
	for (const reporter of [new TimedJsonReporter({ outputFile: final.json }), new RerunJunitReporter(final.junit)]) {
		yield* promise("Vitest could not write the merged reports", async () => {
			await reporter.onInit(vitest);
			await reporter.onTestRunEnd(vitest.state.getTestModules());
		});
	}
	if (merged.flaky.length > 0) {
		yield* writeFlakyTests(final.flaky, merged.flaky);
	}
	if (vitest.config.coverage.enabled) {
		yield* mergeCoverage(vitest, outputDir, attempt);
	}
	const snapshot: Snapshot = {
		errors: vitest.state.getUnhandledErrors(),
		failures: merged.failures,
		files: vitest.state.getFiles(),
		flaky: merged.flaky,
	};
	return snapshot;
});

export const runAttempt = Effect.fn("VitestRerun.runAttempt")(function* (input: Attempt) {
	const { filter, options } = VitestNode.parseCLI(["vitest", "run", ...input.vitestArgs]);
	const rerun = input.attempt > 1;
	const { shard: _shard, ...unsharded } = options;
	const reports = rerun ? attemptPaths(input.outputDir, input.attempt) : reportPaths(input.outputDir);
	const vitest = yield* start(rerun ? unsharded : options, reports, rerun ? reportPaths(input.outputDir).rerunCache : undefined);
	const snapshot: Snapshot = rerun
		? yield* rerunFailed(vitest, input)
		: yield* promise("Vitest could not run the tests", () => vitest.start(filter)).pipe(
				Effect.map(() => ({ errors: vitest.state.getUnhandledErrors(), failures: {}, files: vitest.state.getFiles(), flaky: [] })),
			);
	yield* saveSnapshot(attemptPaths(input.outputDir, input.attempt).snapshot, snapshot);
	return snapshot.files.some((file) => file.result?.state === "fail") || snapshot.errors.length > 0;
}, Effect.scoped);
