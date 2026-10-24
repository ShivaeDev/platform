import { Effect } from "effect";
import type { EngineOptions } from "#test/EngineOptions.ts";

export function failedChecksWithWorkerEvidenceConfiguration() {
	return (): EngineOptions => ({
		checksFailure: true,
		resultQuery: (_board, observation) => Effect.succeed({ evidence: [observation.output], head: "current-main", kind: "no-change" }),
	});
}
