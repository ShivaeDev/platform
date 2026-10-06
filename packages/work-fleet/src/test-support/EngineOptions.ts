import type { Effect } from "effect";
export interface EngineOptions {
	readonly backlog?: number;
	readonly checkRepair?: boolean;
	readonly checksFailure?: boolean;
	readonly checksGate?: Effect.Effect<void>;
	readonly concurrency?: number;
	readonly deliveryFailure?: boolean;
	readonly denyDelivery?: boolean;
	readonly foreign?: readonly string[];
	readonly lostAcknowledgement?: boolean;
	readonly mainChanges?: readonly string[];
	readonly noChange?: boolean;
	readonly operationCollision?: boolean;
	readonly publishFailure?: boolean;
	readonly publishGate?: Effect.Effect<void>;
	readonly quota?: number;
	readonly repairs?: boolean;
	readonly reviewFailure?: boolean;
	readonly reviewGate?: Effect.Effect<void>;
	readonly reviewRunning?: boolean;
	readonly sameReviewer?: boolean;
	readonly unknownQuota?: boolean;
	readonly wrongHead?: "review" | "checks";
}
