import { Context, Effect, Layer } from "effect";
import type { Story } from "@shivaedev/test-story/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet, type PrepareWork } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { EngineFixture } from "#test/engine.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { engineBoardVerbs } from "#test/engineBoardVerbs.ts";
import { engineEvidence } from "#test/engineEvidence.ts";
import { engineGithubVerbs } from "#test/engineGithubVerbs.ts";
import { engineLostTurnVerbs } from "#test/engineLostTurnVerbs.ts";
import { engineProviderVerbs } from "#test/engineProviderVerbs.ts";
import { engineRpcVerbs } from "#test/engineRpcVerbs.ts";
import { type EngineStory, running } from "#test/engineState.ts";
import { engineStatusVerbs } from "#test/engineStatusVerbs.ts";
import { engineWorldVerbs } from "#test/engineWorldVerbs.ts";

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
					story.tell(`${label} ${workId}: ${state.lastRecord.stage}`);
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
		dispatch: (workId: string) =>
			observe(
				"dispatch",
				workId,
				Effect.suspend(() => running(state).fleet.dispatch(workId)),
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
				Effect.suspend(() => running(state).fleet.reconcile(workId)),
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
				running(state).fleet = Context.get(services, Fleet);
			}),

		waitForStage: (stage: FleetRecord["stage"], workId = "one", maxSteps?: number) => {
			state.workId = workId;
			return story.runUntil((current) => current.lastRecord?.workId === workId && current.lastRecord.stage === stage, { maxSteps });
		},
	};
	return {
		...verbs,
		...engineProviderVerbs(running(state).fixture, story.tell),
		...engineEvidence(state),
		...engineBoardVerbs(state, story.tell),
		...engineWorldVerbs(state, story.tell),
		...engineGithubVerbs(state, story.tell),
		...engineRpcVerbs(state, story.tell),
		...engineLostTurnVerbs(state, story.tell),
		...engineStatusVerbs(state, story.tell),
		fleet: {
			continue: verbs.continueWork,
			dispatch: verbs.dispatch,
			get: verbs.get,
			list: verbs.list,
			prepare: verbs.prepare,
			queueAnswer: verbs.queueAnswer,
			reconcile: verbs.reconcile,
			resolve: verbs.resolve,
		},
		schedule: () =>
			Effect.suspend(() => {
				story.tell("run one Fleet scheduler cycle");
				return provideFleet(cycle);
			}),
	};
}
