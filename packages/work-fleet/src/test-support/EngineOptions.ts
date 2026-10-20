import type { Effect, Layer } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import type { BoardAcknowledgementStale, BoardDecisionAcknowledgement } from "#board/schema.ts";
import type { FleetError } from "#errors.ts";
import type { FleetRecord } from "#model.ts";
import type {
	BoardFailure,
	BoardGateway,
	BoardWork,
	ChangeResult,
	Checks,
	Delivery,
	FleetConfiguration,
	FleetIntegrations,
	WorkPublication,
	WorkResult,
} from "#policy.ts";
import type { MainObservation, Preparation } from "#preparation/schema.ts";
import type { ReportAttachments } from "#reportAttachments.ts";
import type { LaunchSettings, SessionFailure, SessionObservation } from "#session/schema.ts";
import type { SessionTransport } from "#session/service.ts";
export interface EngineOptions {
	readonly acknowledgeFailure?: boolean;
	readonly acknowledgementGate?: Effect.Effect<void>;
	readonly acknowledgementQuery?: (input: BoardDecisionAcknowledgement) => Effect.Effect<void, BoardFailure | BoardAcknowledgementStale>;
	readonly archiveFailure?: boolean;
	readonly areaMergeWaitMs?: number;
	readonly backlog?: number;
	readonly checkRepair?: boolean;
	readonly checksFailure?: boolean;
	readonly checksGate?: Effect.Effect<void>;
	readonly checksQuery?: (result: WorkResult) => Effect.Effect<Checks, FleetError>;
	readonly concurrency?: number;
	readonly continuationGate?: Effect.Effect<void>;
	readonly decorateBoard?: (board: typeof BoardGateway.Service) => typeof BoardGateway.Service;
	readonly decorateTransport?: (transport: typeof SessionTransport.Service) => typeof SessionTransport.Service;
	readonly deliveryFailure?: boolean;
	readonly deliveryQuery?: (result: typeof ChangeResult.Type) => Effect.Effect<Delivery | undefined, FleetError>;
	readonly denyDelivery?: boolean;
	readonly foreignBacklog?: boolean;
	readonly launch?: LaunchSettings;
	readonly lostAcknowledgement?: boolean;
	readonly lostContinuationAcknowledgement?: boolean;
	readonly lostReviewAcknowledgement?: boolean;
	readonly lostReviewContinuationAcknowledgement?: boolean;
	readonly mainChanges?: readonly string[];
	readonly mainQuery?: (preparation: Preparation) => Effect.Effect<MainObservation, FleetError>;
	readonly noChange?: boolean;
	readonly now?: () => number;
	readonly openPullRequests?: FleetConfiguration["openPullRequests"];
	readonly operationCollision?: boolean;
	readonly predict?: typeof FleetIntegrations.Service.predict;
	readonly publicationQuery?: (work: BoardWork) => Effect.Effect<WorkPublication, FleetError>;
	readonly publishFailure?: boolean;
	readonly publishGate?: Effect.Effect<void>;
	readonly quota?: number;
	readonly readRetryMs?: number;
	readonly refreshQuota?: FleetConfiguration["refreshQuota"];
	readonly rejectTurn?: boolean;
	readonly repairs?: boolean;
	readonly reportAttachmentsQuery?: (observation: SessionObservation) => Effect.Effect<ReportAttachments>;
	readonly reportPublicationQuery?: (work: BoardWork) => Effect.Effect<boolean, FleetError>;
	readonly resultQuery?: (board: BoardWork, observation: SessionObservation) => Effect.Effect<WorkResult, FleetError>;
	readonly resultUnavailable?: boolean;
	readonly review?: FleetConfiguration["review"];
	readonly reviewExecution?: "failed" | "interrupted";
	readonly reviewerGuidance?: string;
	readonly reviewFailure?: boolean;
	readonly reviewGate?: Effect.Effect<void>;
	readonly reviewRunning?: boolean;
	readonly sameReviewer?: boolean;
	readonly sessionAcknowledgementGate?: Effect.Effect<void, SessionFailure>;
	readonly submissionFailure?: (call: "session" | "turn") => SessionFailure | undefined;
	readonly transportLayer?: Layer.Layer<SessionTransport>;
	readonly unavailableTurn?: boolean;
	readonly unknownQuota?: boolean;
	readonly workerGuidance?: string;
	readonly writeFailure?: (value: FleetRecord) => SqlError | undefined;
	readonly writeGate?: (value: FleetRecord) => Effect.Effect<void>;
	readonly wrongHead?: "review" | "checks";
}
