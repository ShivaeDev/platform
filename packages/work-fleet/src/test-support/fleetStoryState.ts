import { type Effect, type FileSystem, type Layer, Option } from "effect";
import type { Fleet } from "#fleet.ts";
import type { BoardGateway } from "#policy.ts";
import { captureLogs } from "#test/captureLogs.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import type { EngineFixture } from "#test/engine.ts";
import type { mergedReviewGithub } from "#test/mergedReviewGithub.ts";

export function fleetStoryState(fs: typeof FileSystem.FileSystem.Service) {
	const commits: (readonly unknown[])[] = [];
	const options: EngineOptions = {};
	return {
		board: Option.none<Layer.Layer<BoardGateway, unknown>>(),
		boardRoot: Option.none<string>(),
		commits,
		fs,
		github: Option.none<Effect.Success<ReturnType<typeof mergedReviewGithub>>>(),
		logs: captureLogs(),
		options,
		runtime: Option.none<{
			readonly fixture: EngineFixture<unknown>;
			fleet: typeof Fleet.Service;
			readonly fleetLayer: Layer.Layer<typeof Fleet.Identifier, unknown>;
		}>(),
	};
}
export type FleetStoryState = ReturnType<typeof fleetStoryState>;
