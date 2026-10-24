import { Effect } from "effect";
import { engineConfiguration } from "#test/engineConfiguration.ts";
export const failedChecksWithWorkerEvidence = engineConfiguration("failed checks with worker evidence", () => ({
	checksFailure: true,
	resultQuery: (_board, observation) => Effect.succeed({ evidence: [observation.output], head: "current-main", kind: "no-change" }),
}));
