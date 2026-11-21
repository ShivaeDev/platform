import { Data } from "effect";

// current: rebuilt and equal to the file; unchanged: inputs as last time, so no program was built; removed and, under
// --check, orphaned: a generated file whose module is gone.
export type ModuleStatus = "current" | "missing" | "orphaned" | "refused" | "removed" | "stale" | "unchanged" | "written";

export interface ModuleOutcome {
	readonly module: string;
	readonly output: string;
	readonly status: ModuleStatus;
}

export interface ListOutcome {
	readonly output: string;
	readonly status: Exclude<ModuleStatus, "orphaned" | "removed" | "unchanged">;
}

export interface GenerateReport {
	readonly inputs: readonly string[];
	readonly lists: readonly ListOutcome[];
	readonly modules: readonly ModuleOutcome[];
	readonly programBuilt: boolean;
}

export function problemOf(outcome: ModuleOutcome | ListOutcome): string | undefined {
	switch (outcome.status) {
		case "missing":
		case "stale":
			return `${outcome.output} is ${outcome.status}; run \`pnpm generate\``;
		case "orphaned":
			return `${outcome.output} is left from ${outcome.module}, which defines no module any more; run \`pnpm generate\``;
		case "current":
		case "refused":
		case "removed":
		case "unchanged":
		case "written":
			return undefined;
	}
}

// A refused module, or under --check a missing, stale or orphaned file: the command prints each problem and exits 1.
export class GenerateFailed extends Data.TaggedError("GenerateFailed")<{
	readonly problems: readonly string[];
	readonly report: GenerateReport;
}> {}
