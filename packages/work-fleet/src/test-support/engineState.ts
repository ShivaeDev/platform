import type { Effect } from "effect";
import type { Fleet } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { createEngine } from "#test/createEngine.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import type { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

export interface EngineStory {
	github?: Effect.Success<ReturnType<typeof mergedReviewGithub>>;
	lastRecord?: FleetRecord;
	markdown: boolean;
	options: EngineOptions;
	root: string;
	runtime?: Effect.Success<ReturnType<typeof createEngine<unknown>>> & { fleet: typeof Fleet.Service };
	source: string;
	workId: string;
}

export function running(state: EngineStory) {
	if (state.runtime === undefined) {
		throw new Error("Fleet has not started; configure it before the engine stage finishes");
	}
	return state.runtime;
}
