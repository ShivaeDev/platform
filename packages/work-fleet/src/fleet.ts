import { Effect } from "effect";
import { defineService } from "@shivaedev/effect-service/define-service.ts";
import { closeDecisions } from "#engine/closeDecisions.ts";
import { continueCommand } from "#engine/continueCommand.ts";
import { dispatchCommand } from "#engine/dispatchCommand.ts";
import { ensurePublication } from "#engine/ensurePublication.ts";
import { makeAdvance } from "#engine/makeAdvance.ts";
import { makeLaunch } from "#engine/makeLaunch.ts";
import { makeState } from "#engine/makeState.ts";
import { prepareCommand } from "#engine/prepareCommand.ts";
import { queueAnswerCommand } from "#engine/queueAnswerCommand.ts";
import { reassignCommand } from "#engine/reassignCommand.ts";
import { reconcileCommand } from "#engine/reconcileCommand.ts";
import { recordResponseCommand } from "#engine/recordResponseCommand.ts";
import { FleetRepository } from "#engine/repository.ts";
import { resolveCommand } from "#engine/resolveCommand.ts";
import { cleanupSessions } from "#engine/sessionCleanup.ts";
import { BoardGateway, FleetIntegrations, FleetPolicy } from "#policy.ts";
import type { Preparation } from "#preparation/schema.ts";
import type { LaunchSettings } from "#session/schema.ts";
import { SessionService } from "#session/service.ts";
export interface PrepareWork {
	readonly cwd: string;
	readonly launch?: LaunchSettings | undefined;
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
		continue: continueCommand(state, state.launch),
		dispatch: dispatchCommand(state, state.launch),
		get: (workId: string) => state.load(workId),
		hasLaunchRetry: () => state.store.hasLaunchRetry(),
		list: () => state.store.list(),
		prepare: (input: PrepareWork) => prepareCommand(state)(input).pipe(Effect.flatMap(closeDecisions(state)), Effect.flatMap(cleanupSessions(state))),
		publishDecision: (workId: string) => state.load(workId).pipe(Effect.flatMap((stored) => ensurePublication(state)(stored, true))),
		queueAnswer: queueAnswerCommand(state),
		reassign: reassignCommand(state),
		reconcile: (workId: string) => reconcileCommand(state, state.advance)(workId).pipe(Effect.flatMap(cleanupSessions(state))),
		recordResponse: recordResponseCommand(state),
		resolve: (workId: string, decisionId: string, responseId: string) =>
			resolveCommand(state)(workId, decisionId, responseId).pipe(Effect.flatMap(cleanupSessions(state))),
	}),
	requires: [FleetRepository, BoardGateway, FleetPolicy, FleetIntegrations, SessionService],
});
