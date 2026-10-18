import { Context, Effect, Layer } from "effect";
import { withTestTransaction } from "@shivaedev/effect-test-sql/withTestTransaction.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { views } from "#engine/views.ts";
import { Fleet } from "#fleet.ts";
import { renderStatus } from "#host/renderStatus.ts";
import { SessionFailure } from "#session/schema.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { createEngine, prepareWork } from "#test/engine.ts";
import { lostTurnProvider } from "#test/lostTurnProvider.ts";
import { postgresLayer, postgresUrl } from "#test/postgres.ts";
import { watchRecovery } from "#test/watchRecovery.ts";
import { workPublication } from "#test/workPublication.ts";

interface RecoveryFleetState {
	engine?: Effect.Success<ReturnType<typeof createEngine<never>>> & { fleet: typeof Fleet.Service };
	now: number;
	options: EngineOptions;
	readonly provider: ReturnType<typeof lostTurnProvider>;
	readonly publication: ReturnType<typeof workPublication>;
	quotaAvailable: number;
	reject?: "session" | "turn" | undefined;
}

function running(state: RecoveryFleetState) {
	if (state.engine === undefined) {
		throw new Error("Fleet has not started");
	}
	return state.engine;
}

export const recoveryFleet = storyKit({
	after: {
		*configuration(state) {
			const engine = yield* createEngine({
				...state.options,
				decorateTransport: state.provider.decorate,
				now: () => state.now,
				publicationQuery: state.publication.query,
				refreshQuota: () => Effect.succeed({ available: state.quotaAvailable, expiresAt: Number.MAX_SAFE_INTEGER, observedAt: 0 }),
				submissionFailure: (call) => {
					if (state.reject !== call) {
						return undefined;
					}
					state.reject = undefined;
					return new SessionFailure({ capacity: "serverOverloaded", message: "Replacement capacity unavailable", reason: "rejected" });
				},
			});
			state.engine = { ...engine, fleet: Context.get(yield* Layer.build(engine.fleetLayer), Fleet) };
		},
	},
	around: withTestTransaction,
	create: (): RecoveryFleetState => ({ now: 100, options: {}, provider: lostTurnProvider(), publication: workPublication(), quotaAvailable: 100 }),
	inspect: (state) => ({ now: state.now, submissions: state.engine?.fixture.settings }),
	layer: postgresLayer,
	name: "Fleet recovery",
	runIf: postgresUrl !== undefined,
	stages: ["configuration"],
	verbs: (state, story) => ({
		fleet: {
			cycle: () => {
				story.tell("run the scheduler");
				return cycle.pipe(Effect.provideService(Fleet, running(state).fleet));
			},
			dispatch: (workId = "one") => {
				story.tell(`dispatch ${workId}`);
				return running(state).fleet.dispatch(workId);
			},
			get: (workId = "one") => running(state).fleet.get(workId),
			prepare: (workId = "one") => {
				story.tell(`prepare ${workId}`);
				return prepareWork(workId).pipe(Effect.provideService(Fleet, running(state).fleet));
			},
			reconcile: (workId = "one") => {
				story.tell(`reconcile ${workId}`);
				return running(state).fleet.reconcile(workId);
			},
			restart: Effect.fnUntraced(function* () {
				story.tell("restart Fleet against its persisted records");
				const engine = running(state);
				engine.fleet = Context.get(yield* Layer.build(Layer.fresh(engine.fleetLayer)), Fleet);
			}),
		},
		get observed() {
			const { decisions, launched, settings, starts } = running(state).fixture;
			return { decisions, launched, settings, starts };
		},
		provider: {
			active: (sessionId: string) => {
				story.tell("the lost thread has another active turn");
				state.provider.active(sessionId);
			},
			idle: (sessionId: string) => {
				story.tell("the lost thread becomes idle");
				state.provider.idle(sessionId);
			},
			lose: (sessionId: string | undefined) => {
				story.tell("the provider loses the accepted turn");
				state.provider.lose(sessionId);
			},
			rejectNext: (call: "session" | "turn") => {
				story.tell(`the provider will reject the next ${call} for capacity`);
				state.reject = call;
			},
		},
		publication: {
			branch: () => {
				story.tell("publish the remote branch");
				state.publication.branch();
			},
			pullRequest: (status: "open" | "closed" | "merged" = "open") => {
				story.tell(`publish a ${status} PR`);
				state.publication.pullRequest(status);
			},
		},
		quota: (available: number) => {
			story.tell(`provider quota permits ${available} submissions`);
			state.quotaAvailable = available;
		},
		respond: (id: string, action: "retry" | "release") => {
			story.tell(`answer the decision with ${action}`);
			return running(state).fixture.respond(id, action);
		},
		setTime: (now: number) => {
			story.tell(`the clock reaches ${now}`);
			state.now = now;
		},
		status: Effect.fnUntraced(function* () {
			return renderStatus(views((yield* running(state).fleet.list()).map(({ value }) => value)));
		}),
		watch: (follow = true) => {
			story.tell(`run watch${follow ? " --follow" : ""} against the persisted Fleet snapshots over HTTP`);
			return watchRecovery(follow);
		},
	}),
});
