import type { Effect } from "effect";
import type { DecisionCode } from "#DecisionCode.ts";
import type { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import type { EngineFixture } from "#test/engine.ts";
import type { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

export interface RecoveryContext {
	readonly fixture: EngineFixture<unknown>;
	readonly github: Effect.Success<ReturnType<typeof mergedReviewGithub>>;
	readonly readRetries: FleetRecord[];
	readonly root: string;
	readonly source: string;
}
export interface RecoveryCase {
	readonly code: DecisionCode;
	readonly enter: (context: RecoveryContext) => Effect.Effect<unknown, unknown, typeof Fleet.Identifier>;
	readonly name: string;
	readonly observe?: () => {
		readonly requests?: number;
		readonly reads?: number;
		readonly deliveries?: number;
		readonly acceptedDeliveries?: readonly { readonly head: string; readonly revision: string; readonly url: string }[];
		readonly readPullRequests?: readonly string[];
		readonly publications?: number;
		readonly published?: boolean | undefined;
	};
	readonly options?: EngineOptions;
	readonly recovery?: string;
	readonly restore?: (context: RecoveryContext) => Effect.Effect<unknown, unknown, typeof Fleet.Identifier>;
	readonly sites: readonly string[];
}
