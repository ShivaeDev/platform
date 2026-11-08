import { Effect } from "effect";
import { defineRailway as defineRailwayProgram, type RailwayContext, type RailwayProgram } from "railway/iac";

type RailwayProject = Parameters<RailwayProgram>[1];
type EffectRailwayProgram = (ctx: RailwayContext, project: RailwayProject) => Effect.Effect<ReturnType<RailwayProject>, unknown>;

export function defineRailway(program: EffectRailwayProgram): RailwayProgram {
	return defineRailwayProgram((ctx, project) => Effect.runPromise(program(ctx, project)));
}
