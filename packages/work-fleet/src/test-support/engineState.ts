import type { Context, Deferred, Effect, Layer } from "effect";
import type { BoardDecision } from "#board/schema.ts";
import type { Health, HealthPublication, HealthSnapshot } from "#engine/health.ts";
import type { Fleet } from "#fleet.ts";
import type { MainSource } from "#host/mainSource.ts";
import type { FleetRecord } from "#model.ts";
import type { BoardGateway, WorkResult } from "#policy.ts";
import type { boardReads } from "#test/boardReads.ts";
import { captureLogs } from "#test/captureLogs.ts";
import type { createEngine } from "#test/createEngine.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { type EngineWorld, worldDefaults } from "#test/EngineWorld.ts";
import type { EngineBudget } from "#test/engineBudget.ts";
import type { ProtocolRejections } from "#test/engineProtocolRejections.ts";
import type { EngineTiming } from "#test/engineTimingState.ts";
import type { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import type { PredictionRepository } from "#test/predictionRepository.ts";

export interface SweepPullRequest {
	checksFailed?: boolean;
	conflicting?: boolean;
	paths: readonly string[];
	state: "open" | "closed" | "merged";
}

export interface EngineStory extends EngineWorld {
	acknowledgementsPaused?: boolean;
	board?: Layer.Layer<BoardGateway, unknown>;
	budget?: EngineBudget;
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
	protocolRejections?: ProtocolRejections;
	publicationContext?: Context.Context<typeof Fleet.Identifier | Health | HealthPublication | HealthSnapshot>;
	publishViews?: boolean;
	readinessPublications?: BoardDecision[];
	restoreHealth?: () => void;
	restoreStatus?: () => void;
	resultObservation?: { value: WorkResult; unavailable: boolean };
	root: string;
	runtime?: Effect.Success<ReturnType<typeof createEngine<unknown>>> & { fleet: typeof Fleet.Service };
	source: string;
	sourceReads?: Effect.Success<ReturnType<typeof boardReads>>;
	sweepReadiness?: { readonly entered: Deferred.Deferred<void>; readonly resume: Deferred.Deferred<void> };
	sweepRequests?: Map<string, SweepPullRequest>;
	timing?: EngineTiming;
	validationEntered?: Deferred.Deferred<void>;
	workId: string;
}

export function newEngineState(): EngineStory {
	const state: EngineStory = {
		...worldDefaults(),
		commits: [],
		logs: captureLogs(),
		markdown: false,
		options: {},
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
