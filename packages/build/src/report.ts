import { Data } from "effect";

// current: rebuilt and equal to the file; unchanged: inputs as last time, so no program was built; removed and, under
// --check, orphaned: a generated file whose module is gone.
export type ModuleStatus = "current" | "missing" | "orphaned" | "refused" | "removed" | "stale" | "unchanged" | "written";

export interface ModuleOutcome {
	readonly module: string;
	readonly output: string;
	readonly status: ModuleStatus;
}

export interface GenerateReport {
	// Every file whose content went into a module's cache key, absolute, so a watcher knows which edits call for a new run.
	readonly inputs: readonly string[];
	readonly modules: readonly ModuleOutcome[];
	readonly programBuilt: boolean;
}

export function problemOf({ module, output, status }: ModuleOutcome): string | undefined {
	switch (status) {
		case "missing":
		case "stale":
			return `${output} is ${status}; run \`pnpm generate\``;
		case "orphaned":
			return `${output} is left from ${module}, which defines no module any more; run \`pnpm generate\``;
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
