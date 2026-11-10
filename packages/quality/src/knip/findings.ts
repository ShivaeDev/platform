import { Schema } from "effect";
import type { Finding } from "#rule.ts";

const ReportSymbol = Schema.Struct({ line: Schema.optional(Schema.Number), name: Schema.String });
const Issue = Schema.Struct({
	dependencies: Schema.optional(Schema.Array(ReportSymbol)),
	devDependencies: Schema.optional(Schema.Array(ReportSymbol)),
	exports: Schema.optional(Schema.Array(ReportSymbol)),
	file: Schema.String,
	files: Schema.optional(Schema.Array(ReportSymbol)),
	nsExports: Schema.optional(Schema.Array(ReportSymbol)),
	nsTypes: Schema.optional(Schema.Array(ReportSymbol)),
	optionalPeerDependencies: Schema.optional(Schema.Array(ReportSymbol)),
	types: Schema.optional(Schema.Array(ReportSymbol)),
	unlisted: Schema.optional(Schema.Array(ReportSymbol)),
});
const Report = Schema.Struct({ issues: Schema.Array(Issue) });

const REPAIRS = [
	["dependencies", "Unused dependency. Remove it from the package manifest if it is no longer needed"],
	["devDependencies", "Unused development dependency. Remove it from the package manifest if it is no longer needed"],
	["exports", "Unused export. Remove the export or use it from an entry point"],
	["files", "Unused file. Remove it or reach it from a declared entry point"],
	["nsExports", "Unused namespace export. Remove the export or use it from an entry point"],
	["nsTypes", "Unused namespace type. Remove the export or use it from an entry point"],
	["optionalPeerDependencies", "Unused optional peer dependency. Remove it from the package manifest if it is no longer needed"],
	["types", "Unused exported type. Remove the export or use it from an entry point"],
	["unlisted", "Missing package dependency. Declare it in the importing package's manifest"],
] as const;

export const KNIP_ISSUES = REPAIRS.map(([kind]) => kind);

export function knipFindings(stdout: string): readonly Finding[] {
	const report = Schema.decodeUnknownSync(Schema.fromJsonString(Report))(stdout);
	return report.issues.flatMap((issue) =>
		REPAIRS.flatMap(([kind, repair]) => {
			const symbols = issue[kind];
			return (symbols ?? []).map((symbol) => ({
				file: issue.file,
				line: symbol.line,
				message: `${repair}: ${symbol.name}.`,
				subject: `${kind}:${symbol.name}`,
			}));
		}),
	);
}
