import { Schema } from "effect";
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

export async function biomeReport(root: string, args: readonly string[]): Promise<Report> {
	const command = [...args, "--reporter=json", "--max-diagnostics=none", "."];
	const run = await runBiome(root, command);
	const report = decodeReport(run.stdout.trim());
	if (report._tag === "None") {
		throw failure(command, run);
	}
	return { ...report.value, diagnostics: recognizeDiagnostics(root, report.value.diagnostics) };
}
