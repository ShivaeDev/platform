import { Context, Effect, Layer } from "effect";
import { CommittedSink } from "@shivaedev/effect-sql/transact.ts";
import type { Story } from "@shivaedev/test-story/server/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet, type PrepareWork } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import { boardReadRetry } from "#test/boardReadRetry.ts";
import type { EngineFixture } from "#test/engine.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { engineBoardSchedulerVerbs } from "#test/engineBoardSchedulerVerbs.ts";
import { engineBoardVerbs } from "#test/engineBoardVerbs.ts";
import { engineBudgetVerbs } from "#test/engineBudget.ts";
import { engineContinuationVerbs } from "#test/engineContinuationVerbs.ts";
import { engineDecisionVerbs } from "#test/engineDecisionVerbs.ts";
import { engineDispatchVerbs } from "#test/engineDispatchVerbs.ts";
import { engineEvidence } from "#test/engineEvidence.ts";
import { engineGithubVerbs } from "#test/engineGithubVerbs.ts";
import { engineHostAnswers } from "#test/engineHostAnswers.ts";
import { engineLaunchVerbs } from "#test/engineLaunchVerbs.ts";
import { engineLostTurnVerbs } from "#test/engineLostTurnVerbs.ts";
import { engineNativeVerbs } from "#test/engineNativeVerbs.ts";
import { enginePredictionVerbs } from "#test/enginePredictionVerbs.ts";
import { engineProtocolVerbs } from "#test/engineProtocolRejections.ts";
import { engineProviderVerbs } from "#test/engineProviderVerbs.ts";
import { enginePublicationVerbs } from "#test/enginePublicationVerbs.ts";
import { engineRaceVerbs } from "#test/engineRaceVerbs.ts";
import { engineRecoveryVerbs } from "#test/engineRecoveryVerbs.ts";
import { engineReportVerbs } from "#test/engineReportVerbs.ts";
import { engineRetryVerbs } from "#test/engineRetryVerbs.ts";
import { engineRpcVerbs } from "#test/engineRpcVerbs.ts";
import { engineSchedulingVerbs } from "#test/engineSchedulingVerbs.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { engineStatusVerbs } from "#test/engineStatusVerbs.ts";
import { engineSweepVerbs } from "#test/engineSweepVerbs.ts";
import { engineTimingVerbs } from "#test/engineTimingVerbs.ts";
import { engineWorldVerbs } from "#test/engineWorldVerbs.ts";
import { githubReadRetry } from "#test/githubReadRetry.ts";
import { reportFailureVerbs } from "#test/reportFailureVerbs.ts";
import { sessionNamingVerbs } from "#test/sessionNamingVerbs.ts";

export function engineVerbs(state: EngineStory, story: Story<EngineStory, Effect.Effect<void, unknown>>) {
	function provideFleet<A, E, R>(effect: Effect.Effect<A, E, R>) {
		return Effect.suspend(() => effect.pipe(Effect.provideService(Fleet, running(state).fleet)));
	}
	function observe<E, A extends { readonly value: FleetRecord }>(label: string, workId: string, effect: Effect.Effect<A, E>) {
		return effect.pipe(
			Effect.tap((record) =>
				Effect.sync(() => {
					state.workId = workId;
					state.lastRecord = record.value;
					story.tell(`${label} ${workId}: ${state.lastRecord.step}`);
				}),
			),
		);
	}
	const verbs = {
		approveWork: (workId: string, revision: string) => {
			story.tell(`approve ${workId} at ${revision}`);
			running(state).fixture.approveWork(workId, revision);
		},
		continueWork: (...args: Parameters<typeof Fleet.Service.continue>) =>
			observe("continue", args[0], provideFleet(Effect.flatMap(Fleet, (fleet) => fleet.continue(...args)))),
		dispatch: (workId: string, ...args: Parameters<typeof Fleet.Service.dispatch> extends [string, ...infer TRest] ? TRest : never) =>
			observe(
				"dispatch",
				workId,
				Effect.suspend(() => running(state).fleet.dispatch(workId, ...args)),
			),
		editWork: (workId: string, revision: string) => {
			story.tell(`edit ${workId} to ${revision}`);
			running(state).fixture.editWork(workId, revision);
		},
		finishWorkers: () => {
			const fixture = running(state).fixture;
			if (fixture.observations.size === 0) {
				throw new Error("No worker turn is available to finish");
			}
			finishWorkers(fixture);
			story.tell("workers finish their turns");
		},
		get: (workId: string) =>
			observe(
				"read",
				workId,
				Effect.suspend(() => running(state).fleet.get(workId)),
			),
		list: () => Effect.suspend(() => running(state).fleet.list()),
		prepare: (input: PrepareWork) =>
			observe(
				"prepare",
				input.workId,
				Effect.suspend(() => running(state).fleet.prepare(input)),
			),
		prepareWork: (workId: string) => observe("prepare", workId, provideFleet(prepareWork(workId))),
		queueAnswer: (...args: Parameters<typeof Fleet.Service.queueAnswer>) =>
			observe("queue answer", args[0], provideFleet(Effect.flatMap(Fleet, (fleet) => fleet.queueAnswer(...args)))),
		reconcile: (workId: string) =>
			observe(
				"reconcile",
				workId,
				Effect.suspend(() => running(state).fleet.reconcile(workId)).pipe(
					Effect.provideService(CommittedSink, (changes) => Effect.sync(() => state.commits.push(changes))),
				),
			),
		resolve: (workId: string, decisionId: string, responseId: string) =>
			observe(
				"resolve",
				workId,
				Effect.suspend(() => running(state).fleet.resolve(workId, decisionId, responseId)),
			),
		respond: (...args: Parameters<EngineFixture["respond"]>) => {
			story.tell(`answer decision ${args[0]}: ${args[1]}`);
			return running(state).fixture.respond(...args);
		},
		restart: () =>
			Effect.gen(function* () {
				story.tell("restart Fleet from PostgreSQL");
				const services = yield* Layer.build(running(state).restartLayer());
				state.previousFleet = running(state).fleet;
				running(state).fleet = Context.get(services, Fleet);
			}),
		waitForStage: (step: FleetRecord["step"], workId = "one", maxSteps?: number) => {
			state.workId = workId;
			return story.runUntil((current) => current.lastRecord?.workId === workId && current.lastRecord.step === step, { maxSteps });
		},
	};
	return {
		...verbs,
		publications: enginePublicationVerbs(state, story.tell),
		...engineBoardSchedulerVerbs(state, story.tell),
		...engineProtocolVerbs(state, story.tell),
		...engineBudgetVerbs(state, story.tell),
		...engineDispatchVerbs(state),
		...engineTimingVerbs(state, story.tell),
		...boardReadRetry(state, story.tell),
		...githubReadRetry(state, story.tell),
		...engineContinuationVerbs(state, story.tell),
		...engineProviderVerbs(running(state).fixture, story.tell),
		...enginePredictionVerbs(state, story.tell),
		...engineEvidence(state),
		...engineSchedulingVerbs(state, story.tell),
		...engineDecisionVerbs(state, story.tell),
		...engineBoardVerbs(state, story.tell),
		...engineWorldVerbs(state, story.tell),
		...engineGithubVerbs(state, story.tell),
		...engineRpcVerbs(state, story.tell),
		...engineHostAnswers(state, story.tell),
		...engineRecoveryVerbs(state, story.tell),
		...engineRetryVerbs(state, story.tell),
		...reportFailureVerbs(state, story.tell),
		...sessionNamingVerbs(state, story.tell),
		...engineReportVerbs(state, story.tell),
		...engineRaceVerbs(state, story.tell),
		...engineNativeVerbs(state, story.tell),
		...engineLostTurnVerbs(state, story.tell),
		...engineStatusVerbs(state, story.tell),
		...engineLaunchVerbs(state, story.tell),
		...engineSweepVerbs(state, story.tell),
		fleet: {
			...running(state).fleet,
			continue: verbs.continueWork,
			dispatch: verbs.dispatch,
			get: verbs.get,
			list: verbs.list,
			prepare: verbs.prepare,
			queueAnswer: verbs.queueAnswer,
			reassign: engineDecisionVerbs(state, story.tell).reassign,
			reconcile: verbs.reconcile,
			resolve: verbs.resolve,
		},
		schedule: () =>
			Effect.suspend(() => {
				story.tell("run one Fleet scheduler cycle");
				const scheduled = provideFleet(cycle).pipe(Effect.provide(state.logs.layer));
				return state.publicationContext === undefined ? scheduled : scheduled.pipe(Effect.provideContext(state.publicationContext));
			}),
	};
}
