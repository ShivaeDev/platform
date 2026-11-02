import { Effect } from "effect";
import * as VitestNode from "vitest/node";
import { defineService } from "@shivaedev/service/defineService.ts";
import { failWith } from "#error.ts";
import type { Snapshot } from "#internal/snapshot.ts";
import { deferCoverageThresholds } from "./deferCoverageThresholds.ts";
import { mergeSnapshotSummary } from "./mergeSnapshotSummary.ts";
import { RerunJunitReporter } from "./RerunJunitReporter.ts";
import { TimedJsonReporter } from "./TimedJsonReporter.ts";
import type { Files } from "./tasks.ts";
import { writeMergedReports } from "./writeMergedReports.ts";

interface RunOptions {
	readonly cacheDir?: string;
	readonly reports: { readonly json: string; readonly junit: string };
	readonly rerun: boolean;
	readonly vitestArgs: readonly string[];
}

export interface Selection {
	readonly fileId: string;
	readonly testIds?: string[];
}

function promise<A>(message: string, run: () => Promise<A>) {
	return Effect.tryPromise({ catch: failWith(message), try: run });
}

const open = Effect.fn("VitestRerun.open")(function* (input: RunOptions) {
	const { filter, options } = yield* Effect.try({
		catch: (cause) => failWith(`Could not parse Vitest arguments: ${cause instanceof Error ? cause.message : String(cause)}`)(cause),
		try: () => VitestNode.parseCLI(["vitest", "run", ...input.vitestArgs]),
	});
	const { shard: _shard, ...unsharded } = options;
	const junit = new RerunJunitReporter(input.reports.junit);
	const vitest = yield* Effect.acquireRelease(
		promise("Vitest could not start", () =>
			VitestNode.createVitest(
				{
					...(input.rerun ? unsharded : options),
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
		start: () => promise("Vitest could not run the tests", () => vitest.start(filter)).pipe(Effect.asVoid),
	};
});

export const VitestRunner = defineService({
	id: "@shivaedev/vitest-rerun/VitestRunner",
	initialize: Effect.void,
	methods: () => ({ open }),
	requires: [],
});

export type AttemptRunner = Effect.Success<ReturnType<typeof open>>;
