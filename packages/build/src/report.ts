import { Data } from "effect";

// current: rebuilt and equal to the file; unchanged: inputs as last time, so no program was built.
export type ModuleStatus = "current" | "missing" | "refused" | "stale" | "unchanged" | "written";

export interface ModuleOutcome {
	readonly module: string;
	readonly output: string;
	readonly status: ModuleStatus;
}

export interface GenerateReport {
	readonly modules: readonly ModuleOutcome[];
	readonly programBuilt: boolean;
}

// A refused module, or under --check a missing or stale file: the command prints each problem and exits 1.
export class GenerateFailed extends Data.TaggedError("GenerateFailed")<{
	readonly problems: readonly string[];
	readonly report: GenerateReport;
}> {}
