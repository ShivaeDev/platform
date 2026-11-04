import { ImportAnalysisFailure } from "#adapters/ImportAnalysisFailure.ts";

export function analysisFailure(root: string, cause: unknown): ImportAnalysisFailure {
	return new ImportAnalysisFailure({ message: `Cannot analyze imports in ${root}: ${cause instanceof Error ? cause.message : String(cause)}`, root });
}
