import { Effect } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { dispatchCommand } from "#engine/dispatchCommand.ts";
import { makeAdvance } from "#engine/makeAdvance.ts";
import { makeLaunch } from "#engine/makeLaunch.ts";
import { makeState } from "#engine/makeState.ts";
import { prepareCommand } from "#engine/prepareCommand.ts";
import { reconcileCommand } from "#engine/reconcileCommand.ts";
import { FleetRepository } from "#engine/repository.ts";
import { resolveCommand } from "#engine/resolveCommand.ts";
import { BoardGateway, FleetIntegrations, FleetPolicy } from "#policy.ts";
import type { Preparation } from "#preparation/schema.ts";
import { SessionService } from "#session/service.ts";
export interface PrepareWork {
	readonly cwd: string;
	readonly preparation: Preparation;
	readonly prompt: string;
	readonly workId: string;
}
export const Fleet = defineService({
	id: "@shivaedev/work-fleet/Fleet",
	initialize: Effect.gen(function* () {
		const state = yield* makeState;
		const launch = makeLaunch(state);
		return { ...state, advance: makeAdvance(state, launch), launch };
	}),
	methods: (state) => ({
		dispatch: dispatchCommand(state, state.launch),
		get: (workId: string) => state.load(workId),
		list: () => state.store.list(),
		prepare: prepareCommand(state),
		reconcile: reconcileCommand(state, state.advance),
		resolve: resolveCommand(state),
	}),
	requires: [FleetRepository, BoardGateway, FleetPolicy, FleetIntegrations, SessionService],
});
