import { Context, Effect, Layer } from "effect";
import { withTestTransaction } from "@shivaedev/effect-test-sql/withTestTransaction.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { SessionFailure } from "#session/schema.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { createEngine, prepareWork } from "#test/engine.ts";
import { lostTurnProvider } from "#test/lostTurnProvider.ts";
import { postgresLayer, postgresUrl } from "#test/postgres.ts";
import { workPublication } from "#test/workPublication.ts";

interface RecoveryFleetState {
	engine?: Effect.Success<ReturnType<typeof createEngine<never>>> & { fleet: typeof Fleet.Service };
	now: number;
	options: EngineOptions;
	readonly provider: ReturnType<typeof lostTurnProvider>;
	readonly publication: ReturnType<typeof workPublication>;
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
				submissionFailure: (call) => {
					if (state.reject !== call) {
						return undefined;
					}
					state.reject = undefined;
					return new SessionFailure({ capacity: "serverOverloaded", message: "Replacement capacity unavailable", reason: "rejected" });
				},
			});
			state.engine = { ...engine, fleet: Context.get(yield* Layer.build(engine.layer), Fleet) };
		},
	},
	around: withTestTransaction,
	create: (): RecoveryFleetState => ({ now: 100, options: {}, provider: lostTurnProvider(), publication: workPublication() }),
	inspect: (state) => ({ now: state.now, submissions: state.engine?.fixture.settings }),
	layer: postgresLayer,
	name: "Fleet recovery",
	runIf: postgresUrl !== undefined,
	stages: ["configuration"],
	verbs: (state, story) => ({
		get fixture() {
			return running(state).fixture;
		},
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
				engine.fleet = Context.get(yield* Layer.build(Layer.fresh(engine.layer)), Fleet);
			}),
		},
		provider: {
			lose: (sessionId: string | undefined) => {
				story.tell("the provider loses the accepted turn");
				state.provider.lose(sessionId);
			},
			rejectNext: (call: "session" | "turn") => {
				story.tell(`the provider will reject the next ${call} for capacity`);
				state.reject = call;
			},
		},
		publication: state.publication,
		setTime: (now: number) => {
			story.tell(`the clock reaches ${now}`);
			state.now = now;
		},
	}),
});

export function lostAcknowledgement() {
	return recoveryFleet.trait("configuration", "the accepted turn acknowledgement is lost", (state) => {
		state.options = { ...state.options, lostAcknowledgement: true };
	});
}

export function publishedWork(kind: "none" | "branch" | "pr") {
	return recoveryFleet.trait("configuration", `published work is ${kind}`, (state) => {
		if (kind === "pr") {
			state.publication.pullRequest();
		} else if (kind === "branch") {
			state.publication.branch();
		} else {
			state.publication.neighbour();
		}
	});
}

export function unreadablePublication(kind: "branch" | "pr") {
	return recoveryFleet.trait("configuration", `the ${kind} publication read is unavailable`, (state) => {
		if (kind === "branch") {
			state.publication.unavailable();
		} else {
			state.publication.pullsUnavailable();
		}
	});
}
