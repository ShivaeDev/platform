import { Context, Effect, Layer } from "effect";
import type { Story } from "@shivaedev/test-story/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet, type PrepareWork } from "#fleet.ts";
import type { FleetRecord } from "#model.ts";
import type { FleetConfiguration } from "#policy.ts";
import type { EngineFixture } from "#test/engine.ts";
import { finishWorkers, prepareWork } from "#test/engine.ts";
import { engineProviderVerbs } from "#test/engineProviderVerbs.ts";
import { type EngineStory, running } from "#test/engineState.ts";

export function engineVerbs(state: EngineStory, story: Story<EngineStory, Effect.Effect<void, unknown>>) {
	function use<A, E, R>(effect: Effect.Effect<A, E, R>) {
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
		continueWork: (...args: Parameters<typeof Fleet.Service.continue>) => use(Effect.flatMap(Fleet, (fleet) => fleet.continue(...args))),
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
			finishWorkers(running(state).fixture);
			story.tell("workers finish their turns");
		},
		fixture: running(state).fixture,
		get: (workId: string) =>
			observe(
				"read",
				workId,
				Effect.suspend(() => running(state).fleet.get(workId)),
			),
		github: state.github,
		list: () => Effect.suspend(() => running(state).fleet.list()),
		prepare: (input: PrepareWork) =>
			observe(
				"prepare",
				input.workId,
				Effect.suspend(() => running(state).fleet.prepare(input)),
			),
		prepareWork: (workId: string) => observe("prepare", workId, use(prepareWork(workId))),
		queueAnswer: (...args: Parameters<typeof Fleet.Service.queueAnswer>) => use(Effect.flatMap(Fleet, (fleet) => fleet.queueAnswer(...args))),
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
		restart: <A, E>(effect: Effect.Effect<A, E, typeof Fleet.Identifier>, configure?: (policy: FleetConfiguration) => FleetConfiguration) =>
			Effect.gen(function* () {
				story.tell("restart Fleet from PostgreSQL");
				const services = yield* Layer.build(running(state).restartLayer(configure));
				running(state).fleet = Context.get(services, Fleet);
				return yield* use(effect);
			}),

		root: state.root,
		source: state.source,
		use,
		waitForStage: (stage: FleetRecord["stage"], workId = "one", maxSteps?: number) => {
			state.workId = workId;
			return story.runUntil((current) => current.lastRecord?.workId === workId && current.lastRecord.stage === stage, { maxSteps });
		},
	};
	return {
		...verbs,
		...engineProviderVerbs(running(state).fixture, story.tell),
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
		pullRequest: () => {
			if (state.github === undefined) {
				throw new Error("This story needs a GitHub pull request trait");
			}
			return state.github;
		},
		schedule: () => use(cycle),
	};
}
