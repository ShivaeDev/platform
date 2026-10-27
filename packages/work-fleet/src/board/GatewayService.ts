import type { Effect } from "effect";
import type { CloseFinishedOptions } from "#board/closeFinishedDecisions.ts";
import type {
	BoardAcknowledgementStale,
	BoardDecision,
	BoardDecisionAcknowledgement,
	BoardDecisionReading,
	BoardReport,
	ClosedDecision,
} from "#board/schema.ts";
import type { BoardFailure, BoardWork, Decision } from "#policy.ts";
import type { SessionObservation } from "#session/schema.ts";

export interface BoardGatewayService {
	readonly acknowledgeDecision: (input: BoardDecisionAcknowledgement) => Effect.Effect<void, BoardFailure | BoardAcknowledgementStale>;
	readonly closeFinishedDecisions?: (options?: CloseFinishedOptions) => Effect.Effect<readonly ClosedDecision[], BoardFailure>;
	readonly complete?: (workId: string, sourcePath: string, nextAction: string) => Effect.Effect<void, BoardFailure>;
	readonly decision: (workId: string, decision: Decision, original?: BoardWork) => Effect.Effect<BoardDecision, BoardFailure>;
	readonly get: (workId: string, options?: { readonly fresh?: boolean }) => Effect.Effect<BoardWork, BoardFailure>;
	readonly readDecision: (decision: BoardDecision) => Effect.Effect<BoardDecisionReading, BoardFailure>;
	readonly report: (work: BoardWork, observation: SessionObservation, kind?: "review") => Effect.Effect<BoardReport, BoardFailure>;
	readonly respond?: (
		decision: Decision & { readonly published: BoardDecision },
		action: "retry" | "release",
		text?: string,
	) => Effect.Effect<string, BoardFailure>;
}
