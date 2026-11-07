import * as NodePath from "@effect/platform-node/NodePath";
import { Effect, Path, Schema } from "effect";
import { type BiomeRun, runBiome } from "#adapters/biome/run.ts";
import { toolContractDefaults } from "#adapters/biome/toolContractDefaults.ts";
import { recognizeDiagnostics } from "#biome/recognizeDiagnostics.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { SetupFailure } from "#failure.ts";
import { ignoredTrackedPaths } from "#inventory/trackedPaths.ts";

const Position = Schema.Struct({ column: Schema.optionalKey(Schema.Int), line: Schema.Int });

const Diagnostic = Schema.Struct({
	category: Schema.optionalKey(Schema.String),
	location: Schema.Struct({ end: Schema.optionalKey(Position), path: Schema.optionalKey(Schema.String), start: Schema.optionalKey(Position) }),
	message: Schema.String,
	severity: Schema.String,
});

export type Diagnostic = typeof Diagnostic.Type;

const Report = Schema.Struct({
	diagnostics: Schema.Array(Diagnostic),
	summary: Schema.Struct({ changed: Schema.Int, unchanged: Schema.Int }),
});

export type Report = typeof Report.Type;

const decodeReport = Schema.decodeUnknownOption(Schema.fromJsonString(Report));

export const FAILING: ReadonlySet<string> = new Set(["error", "fatal"]);

function failure(args: readonly string[], run: BiomeRun, missing: string, output: string): SetupFailure {
	return new SetupFailure({ message: `biome ${args.join(" ")} exited ${run.code} without ${missing}:\n${output.trim()}` });
}

function unexplained(run: BiomeRun, report: Report): boolean {
	return run.code !== 0 && !report.diagnostics.some((diagnostic) => FAILING.has(diagnostic.severity));
}

const reportFor = Effect.fn("Biome.reportFor")(function* (
	root: string,
	args: readonly string[],
	paths: readonly string[],
	exceptions: readonly ExceptionDeclaration[],
	nonEffectFolders: readonly string[],
) {
	const command = [...args, "--reporter=json", "--max-diagnostics=none", ...paths];
	const run = yield* runBiome(root, command, exceptions, nonEffectFolders);
	const report = decodeReport(run.stdout.trim());
	if (report._tag === "None") {
		return yield* Effect.fail(failure(command, run, "a report", [run.stdout, run.stderr].join("\n")));
	}
	if (report.value.summary.changed + report.value.summary.unchanged === 0 && !args.includes("--no-errors-on-unmatched")) {
		return yield* new SetupFailure({
			message: `biome ${command.join(" ")} processed no files. Check files.includes in biome.json or biome.jsonc so Quality has files to check.`,
		});
	}
	if (unexplained(run, report.value)) {
		return yield* Effect.fail(failure(command, run, "a failing diagnostic", run.stderr));
	}
	return report.value;
});

export const biomeReport = Effect.fn("Biome.biomeReport")(function* (
	root: string,
	args: readonly string[],
	exceptions: readonly ExceptionDeclaration[] = [],
	files: readonly string[] = ["."],
	nonEffectFolders: readonly string[] = [],
) {
	const { relative, sep } = yield* Path.Path.pipe(Effect.provide(NodePath.layer));

	const [report, tracked] = yield* Effect.all([reportFor(root, args, files, exceptions, nonEffectFolders), ignoredTrackedPaths(root)], {
		concurrency: "unbounded",
	});
	const paths = tracked
		.map((path) => relative(root, path))
		.filter((path) => files.includes(".") || files.includes(path))
		.filter((path) => !path.split(sep).some((part) => part === ".git" || part === ".worktrees" || part === "node_modules"));
	const extraArgs = [...args, "--vcs-enabled=false", ...(args.includes("--no-errors-on-unmatched") ? [] : ["--no-errors-on-unmatched"])];
	const extra = paths.length === 0 ? undefined : yield* reportFor(root, extraArgs, paths, exceptions, nonEffectFolders);
	const diagnostics = [...report.diagnostics, ...(extra?.diagnostics ?? [])];
	const unique = [...new Map(diagnostics.map((diagnostic) => [JSON.stringify(diagnostic), diagnostic])).values()];
	return {
		diagnostics: recognizeDiagnostics(root, unique, yield* toolContractDefaults(root, unique)),
		summary: { changed: report.summary.changed + (extra?.summary.changed ?? 0) },
	};
});
