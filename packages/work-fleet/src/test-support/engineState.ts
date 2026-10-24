import type { Deferred, Effect, Layer } from "effect";
import type { BoardDecision } from "#board/schema.ts";
import type { Fleet } from "#fleet.ts";
import type { MainSource } from "#host/mainSource.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardGateway, WorkResult } from "#policy.ts";
import { captureLogs } from "#test/captureLogs.ts";
import type { createEngine } from "#test/createEngine.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { type EngineWorld, worldDefaults } from "#test/EngineWorld.ts";
import type { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import type { PredictionRepository } from "#test/predictionRepository.ts";
import type { RecoveryWorld } from "#test/RecoveryWorld.ts";

export interface SweepPullRequest {
	checksFailed?: boolean;
	conflicting?: boolean;
	paths: readonly string[];
	state: "open" | "closed" | "merged";
}

export interface EngineStory extends EngineWorld {
	board?: Layer.Layer<BoardGateway, unknown>;
	checkCompletionEdit?: () => void;
	commits: (readonly unknown[])[];
	github?: Effect.Success<ReturnType<typeof mergedReviewGithub>>;
	lastRecord?: FleetRecord;
	logs: ReturnType<typeof captureLogs>;
	markdown: boolean;
	options: EngineOptions;
	predictionMain?: typeof MainSource.Service;
	predictionRepository?: PredictionRepository;
	previousFleet?: typeof Fleet.Service;
	readinessPublications?: BoardDecision[];
	recovery: RecoveryWorld;
	resultObservation?: { value: WorkResult; unavailable: boolean };
	root: string;
	runtime?: Effect.Success<ReturnType<typeof createEngine<unknown>>> & { fleet: typeof Fleet.Service };
	source: string;
	sweepReadiness?: { readonly entered: Deferred.Deferred<void>; readonly resume: Deferred.Deferred<void> };
	sweepRequests?: Map<string, SweepPullRequest>;
	workId: string;
}

export function newEngineState(): EngineStory {
	const state: EngineStory = {
		...worldDefaults(),
		commits: [],
		logs: captureLogs(),
		markdown: false,
		options: {},
		recovery: { gates: {}, holdObservation: false, interrupted: [], readsFail: false, turnHidden: false },
		root: "",
		source: "",
		workId: "one",
	};
	state.options = { now: () => state.now };
	return state;
}

export function running(state: EngineStory) {
	if (state.runtime === undefined) {
		throw new Error("Fleet has not started; configure it before the engine step finishes");
	}
	return state.runtime;
}
