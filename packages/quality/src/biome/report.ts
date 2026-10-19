import { relative, sep } from "node:path";
import { Schema } from "effect";
import type { ExceptionDeclaration } from "#exceptions/declaration.ts";
import { ignoredTrackedPaths } from "#inventory/trackedPaths.ts";
import { recognizeDiagnostics } from "./recognizeDiagnostics.ts";
import { type BiomeRun, runBiome } from "./run.ts";

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

function failure(args: readonly string[], run: BiomeRun): Error {
	return new Error(`biome ${args.join(" ")} exited ${run.code} without a report:\n${[run.stdout, run.stderr].join("\n").trim()}`);
}

async function reportFor(
	root: string,
	args: readonly string[],
	paths: readonly string[],
	exceptions: readonly ExceptionDeclaration[],
): Promise<Report> {
	const command = [...args, "--reporter=json", "--max-diagnostics=none", ...paths];
	const run = await runBiome(root, command, exceptions);
	const report = decodeReport(run.stdout.trim());
	if (report._tag === "None") {
		throw failure(command, run);
	}
	return report.value;
}

export async function biomeReport(root: string, args: readonly string[], exceptions: readonly ExceptionDeclaration[] = []): Promise<Report> {
	const [report, tracked] = await Promise.all([reportFor(root, args, ["."], exceptions), ignoredTrackedPaths(root)]);
	const paths = tracked
		.map((path) => relative(root, path))
		.filter((path) => !path.split(sep).some((part) => part === ".git" || part === ".worktrees" || part === "node_modules"));
	const extra = paths.length === 0 ? undefined : await reportFor(root, [...args, "--vcs-enabled=false"], paths, exceptions);
	const diagnostics = [...report.diagnostics, ...(extra?.diagnostics ?? [])];
	const unique = [...new Map(diagnostics.map((diagnostic) => [JSON.stringify(diagnostic), diagnostic])).values()];
	return {
		diagnostics: recognizeDiagnostics(root, unique),
		summary: { changed: report.summary.changed + (extra?.summary.changed ?? 0) },
	};
}
