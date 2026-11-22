import { Effect } from "effect";
import * as VitestNode from "vitest/node";
import { deferCoverageThresholds } from "#adapters/deferCoverageThresholds.ts";
import { RerunJunitReporter } from "#adapters/RerunJunitReporter.ts";
import { TimedJsonReporter } from "#adapters/TimedJsonReporter.ts";
import { writeMergedReports } from "#adapters/writeMergedReports.ts";
import { failWith } from "#error.ts";
import { mergeSnapshotSummary } from "#mergeSnapshotSummary.ts";
import { parseVitestArguments } from "#parseVitestArguments.ts";
import type { Snapshot } from "#snapshot.ts";
import type { Files } from "#tasks.ts";
import type { RunOptions, Selection } from "#VitestRuntime.ts";

function promise<A>(message: string, run: () => Promise<A>) {
	return Effect.tryPromise({ catch: failWith(message), try: run });
}

// Vitest's CLI rewrites these options in its normalizeCliOptions and prepareVitest before it starts and exports no function for it, so compare them on a Vitest upgrade.
function likeTheCli(filter: readonly string[], { exclude, ...options }: VitestNode.CliOptions): VitestNode.CliOptions {
	const located = options.includeTaskLocation === undefined && filter.some((item) => item.includes(":"));
	const typecheckOnly = typeof options.typecheck?.only === "boolean" && options.typecheck.enabled === undefined;
	return {
		...options,
		...(exclude === undefined ? {} : { cliExclude: [exclude].flat() }),
		...(located ? { includeTaskLocation: true } : {}),
		...(typecheckOnly ? { typecheck: { ...options.typecheck, enabled: true } } : {}),
		...(options.standalone === true && filter.length > 0 ? { standalone: false } : {}),
	};
}

export const open = Effect.fn("VitestRerun.open")(function* (input: RunOptions) {
	const { filter, options } = yield* parseVitestArguments(input.vitestArgs);
	// Command-line reporters would replace the reports the merge reads, and each would describe only its own attempt.
	const { reporter: _reporter, ...withoutReporter } = likeTheCli(filter, options);
	const { shard: _shard, ...unsharded } = withoutReporter;
	const junit = new RerunJunitReporter(input.reports.junit);
	const vitest = yield* Effect.acquireRelease(
		promise("Vitest could not start", () =>
			VitestNode.createVitest(
				{
					...(input.rerun ? unsharded : withoutReporter),
					reporters: ["default", new TimedJsonReporter({ outputFile: input.reports.json }), junit],
					retry: 0,
					watch: false,
				},
				input.cacheDir === undefined ? {} : { cacheDir: input.cacheDir },
			),
		),
		(instance) => Effect.promise(() => instance.close()),
	);
	const finishCoverage = yield* deferCoverageThresholds(vitest);
	return {
		collect: (files: Files, summary: Snapshot["summary"]) =>
			Effect.sync(() => {
				for (const file of files) {
					vitest.state.collectFiles(vitest.getProjectByName(file.projectName ?? ""), [file]);
				}
				vitest.snapshot.summary = mergeSnapshotSummary(summary, vitest.snapshot.summary);
			}),
		finish: (outputDir: string, attempt: number, reports: RunOptions["reports"]) =>
			Effect.gen(function* () {
				const coverage = yield* finishCoverage(outputDir, attempt, input.reports.json);
				yield* writeMergedReports(vitest, reports, coverage, junit.unhandledErrors);
			}),
		read: () =>
			Effect.sync(() => ({
				errors: vitest.state.getUnhandledErrors(),
				files: vitest.state.getFiles(),
				root: vitest.config.root,
				summary: vitest.snapshot.summary,
			})),
		rerun: (selected: readonly Selection[]) =>
			Effect.gen(function* () {
				yield* promise("Vitest could not prepare the rerun", () => vitest.standalone());
				const specifications = yield* promise("Vitest could not list test files", () => vitest.globTestSpecifications());
				const failed = specifications.flatMap((spec) => {
					const selection = selected.find((item) => item.fileId === spec.taskId);
					return selection === undefined
						? []
						: [spec.project.createSpecification(spec.moduleId, selection.testIds === undefined ? {} : { testIds: selection.testIds }, spec.pool)];
				});
				if (failed.length === 0) {
					return yield* Effect.fail(failWith("No failed specifications found for the fresh rerun")(undefined));
				}
				yield* promise("Vitest could not rerun the failed tests", () => vitest.runTestSpecifications(failed));
			}),
		start: () =>
			promise("Vitest could not run the tests", () => vitest.start(filter)).pipe(
				Effect.catchTag("VitestRerunError", (error) =>
					vitest.config.passWithNoTests && error.cause instanceof VitestNode.TestsNotFoundError ? Effect.void : Effect.fail(error),
				),
				Effect.asVoid,
			),
	};
});
