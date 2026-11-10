import { Console, Effect, Path } from "effect";
import { Command, Flag } from "effect/cli";
import { generate } from "#generate.ts";
import type { GenerateReport, ModuleStatus } from "#report.ts";

const WORDS: Readonly<Record<ModuleStatus, string>> = {
	current: "current",
	missing: "missing",
	orphaned: "orphaned, its module is gone",
	refused: "refused",
	removed: "removed, its module is gone",
	stale: "stale",
	unchanged: "unchanged, from the cache",
	written: "written",
};

const printReport = Effect.fn("Build.printReport")(function* (report: GenerateReport) {
	for (const { output, status } of report.modules) {
		yield* Console.log(`${output}: ${WORDS[status]}`);
	}
	if (report.modules.length === 0) {
		yield* Console.log("No file of the project calls defineModule.");
	}
});

export const generateCommand = Command.make("generate", { check: Flag.Boolean("check").pipe(Flag.withDefault(false)) }, ({ check }) =>
	Effect.gen(function* () {
		const path = yield* Path.Path;
		const report = yield* generate(path.resolve(), { check }).pipe(
			Effect.tapErrorTag("GenerateFailed", (failed) =>
				printReport(failed.report).pipe(Effect.andThen(Effect.forEach(failed.problems, (problem) => Console.error(problem)))),
			),
		);
		yield* printReport(report);
	}),
).pipe(
	Command.withDescription(
		"Write src/generated/<module>.ts for every defineModule call of the project in the current directory and remove each generated file whose module is gone; --check writes nothing and fails on a missing, stale or orphaned file",
	),
);

export const buildCommand = Command.make("shivaedev-build").pipe(Command.withSubcommands([generateCommand]));
