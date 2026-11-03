import type { Effect } from "effect";
import type { FleetError } from "#errors.ts";
import type { LaunchSettings } from "#session/schema.ts";
import type { OpenPullRequestCurve } from "#storage/model.ts";

export interface FleetConfiguration {
	readonly areaMergeWaitMs?: number;
	// A host that reloads its settings serves the configuration each scheduler pass and launch should apply.
	readonly current?: Effect.Effect<FleetConfiguration>;
	readonly deliveryBacklog?: number;
	readonly executionConcurrency?: number;
	readonly launch?: LaunchSettings;
	readonly localOnlyBoardPath?: string;
	readonly now: () => number;
	readonly openPullRequests?: OpenPullRequestCurve;
	readonly operationId: () => string;
	readonly quota: { readonly available?: number; readonly observedAt: number; readonly expiresAt: number };
	readonly readGuidance?: (role: "worker" | "reviewer") => Effect.Effect<string | undefined, FleetError>;
	readonly readRetryMs?: number;
	readonly refreshQuota?: () => Effect.Effect<FleetConfiguration["quota"], FleetError>;
	readonly repository?: { readonly branch: string; readonly remote: string };
	readonly review?: boolean | "advisory";
	readonly reviewerGuidance?: string;
	readonly sharedEnvironment?: string;
	readonly stallMinutes?: number;
	readonly workerGuidance?: string;
}
