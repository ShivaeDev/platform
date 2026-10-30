import { relative, sep } from "node:path";
import { Effect, Schema } from "effect";
import { type BiomeRun, runBiome } from "#adapters/biome/run.ts";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { SetupFailure } from "#failure.ts";
import { ignoredTrackedPaths } from "#inventory/trackedPaths.ts";
import { recognizeDiagnostics } from "./recognizeDiagnostics.ts";

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
	summary: Schema.Struct({ changed: Schema.Int }),
});

export type Report = typeof Report.Type;

const decodeReport = Schema.decodeUnknownOption(Schema.fromJsonString(Report));

export const FAILING: ReadonlySet<string> = new Set(["error", "fatal"]);

function failure(args: readonly string[], run: BiomeRun, missing: string, output: string): SetupFailure {
	return new SetupFailure({ message: `biome ${args.join(" ")} exited ${run.code} without ${missing}:\n${output.trim()}` });
}

// Biome exits with an error but prints an empty report when no file was processed, so only a failing diagnostic explains a failed run.
function unexplained(run: BiomeRun, report: Report): boolean {
	return run.code !== 0 && !report.diagnostics.some((diagnostic) => FAILING.has(diagnostic.severity));
}

const reportFor = Effect.fn("Biome.reportFor")(function* (
	root: string,
	args: readonly string[],
	paths: readonly string[],
	exceptions: readonly ExceptionDeclaration[],
) {
	const command = [...args, "--reporter=json", "--max-diagnostics=none", ...paths];
	const run = yield* runBiome(root, command, exceptions);
	const report = decodeReport(run.stdout.trim());
	if (report._tag === "None") {
		return yield* Effect.fail(failure(command, run, "a report", [run.stdout, run.stderr].join("\n")));
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
) {
	const [report, tracked] = yield* Effect.all([reportFor(root, args, ["."], exceptions), ignoredTrackedPaths(root)], {
		concurrency: "unbounded",
	});
	const paths = tracked
		.map((path) => relative(root, path))
		.filter((path) => !path.split(sep).some((part) => part === ".git" || part === ".worktrees" || part === "node_modules"));
	const extra =
		paths.length === 0 ? undefined : yield* reportFor(root, [...args, "--vcs-enabled=false", "--no-errors-on-unmatched"], paths, exceptions);
	const diagnostics = [...report.diagnostics, ...(extra?.diagnostics ?? [])];
	const unique = [...new Map(diagnostics.map((diagnostic) => [JSON.stringify(diagnostic), diagnostic])).values()];
	return {
		diagnostics: recognizeDiagnostics(root, unique),
		summary: { changed: report.summary.changed + (extra?.summary.changed ?? 0) },
	};
});
