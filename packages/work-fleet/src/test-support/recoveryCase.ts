import type { Effect } from "effect";
import type { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import type { EngineFixture } from "#test/engine.ts";
import type { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

export interface RecoveryContext {
	readonly fixture: EngineFixture<unknown>;
	readonly github: Effect.Success<ReturnType<typeof mergedReviewGithub>>;
	readonly root: string;
	readonly source: string;
}
export interface RecoveryCase {
	readonly enter: (context: RecoveryContext) => Effect.Effect<unknown, unknown, typeof Fleet.Identifier>;
	readonly name: string;
	readonly options?: EngineOptions;
	readonly progress?: (context: RecoveryContext, before: FleetRecord, after: FleetRecord) => void;
	readonly reason: string | RegExp;
	readonly restore?: (context: RecoveryContext) => Effect.Effect<unknown, unknown, typeof Fleet.Identifier>;
	readonly sites: readonly string[];
}
