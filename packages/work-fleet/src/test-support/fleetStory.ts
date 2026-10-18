import { Context, Effect, Layer, Option } from "effect";
import { CommittedSink } from "@shivaedev/effect-sql/transact.ts";
import { withIsolatedDatabase } from "@shivaedev/effect-test-sql/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { createEngine, type EngineFixture, finishWorkers } from "#test/engine.ts";
import { foreignPrVerbs } from "#test/foreignPrVerbs.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresEnabled, postgresLayer } from "#test/postgres.ts";
import { prepared } from "#test/preparation.ts";

export const fleetStory = storyKit({
	after: {
		*configuration(engine) {
			const { fixture, fleetLayer } = yield* createEngine(engine.options);
			const fleet = Context.get(yield* Layer.build(fleetLayer), Fleet);
			engine.runtime = Option.some({ fixture, fleet });
		},
	},
	around: withIsolatedDatabase,
	create() {
		const options: EngineOptions = {};
		const commits: (readonly unknown[])[] = [];
		return {
			commits,
			github: Option.none<Effect.Success<ReturnType<typeof mergedReviewGithub>>>(),
			options,
			runtime: Option.none<{ readonly fixture: EngineFixture; readonly fleet: typeof Fleet.Service }>(),
		};
	},
	inspect: (engine) => ({ commits: engine.commits, launched: Option.getOrUndefined(engine.runtime)?.fixture.starts.map((start) => start.prompt) }),
	layer: postgresLayer,
	name: "fleet",
	runIf: postgresEnabled,
	stages: ["configuration", "board"],
	verbs: (engine, story) => {
		const { fixture, fleet } = Option.getOrThrow(engine.runtime);
		return {
			...foreignPrVerbs(fixture, fleet, engine.github, story),
			attemptContinue: (id: string, message: string) => {
				story.tell(`Fleet attempts to continue ${id}`);
				return fleet.continue(id, message).pipe(Effect.flip);
			},
			attemptDispatch: (id: string) => {
				story.tell(`Fleet attempts to dispatch ${id}`);
				return fleet.dispatch(id).pipe(Effect.flip);
			},
			commits: engine.commits,
			continue: (id: string, message: string) => {
				story.tell(`Fleet continues ${id}`);
				return fleet.continue(id, message);
			},
			dependencies: (id: string, targets: readonly string[]) => {
				story.tell(`${id} now depends on ${targets.join(", ") || "no other work"}`);
				fixture.dependencies(id, targets);
			},
			dispatch: (id: string) => {
				story.tell(`Fleet dispatches ${id}`);
				return fleet.dispatch(id);
			},
			finishWorkers: () => {
				story.tell("the provider reports that the active turns completed");
				finishWorkers(fixture);
			},
			get: fleet.get,
			prepare: (id: string) => {
				story.tell(`Fleet prepares ${id}`);
				return fleet.prepare({ cwd: "/synthetic", preparation: prepared({ ownedPaths: [`src/${id}.ts`] }), prompt: `Implement ${id}`, workId: id });
			},
			reconcile: (id: string) => {
				story.tell(`Fleet reconciles ${id}`);
				return fleet.reconcile(id).pipe(Effect.provideService(CommittedSink, (changes) => Effect.sync(() => engine.commits.push(changes))));
			},
			schedule: () => {
				story.tell("Fleet runs a scheduler pass");
				return cycle.pipe(Effect.provideService(Fleet, fleet));
			},
			unavailableWork: (id: string, unavailable: boolean) => {
				story.tell(`Board reads for ${id} are ${unavailable ? "unavailable" : "available"}`);
				fixture.unavailableWork(id, unavailable);
			},
			workerQuestion: (id: string, question: string) =>
				Effect.gen(function* () {
					story.tell(`the worker for ${id} finishes its turn with a question`);
					const receipt = (yield* fleet.get(id)).value.attempts.at(-1)?.receipt;
					const observation = receipt === undefined ? undefined : fixture.observations.get(receipt.turnId);
					if (observation === undefined) {
						return yield* Effect.die(new Error(`Missing worker observation for ${id}`));
					}
					fixture.observations.set(observation.receipt.turnId, { ...observation, execution: "completed", output: `FLEET_QUESTION: ${question}` });
				}),
		};
	},
});

export const sharedArea = fleetStory.trait("board", "approved work shares an area in preparation order", (engine) => {
	const { fixture } = Option.getOrThrow(engine.runtime);
	for (const id of ["one", "two", "three"]) {
		fixture.approveWork(id, `board-${id}`);
		fixture.areas(id, ["shared"]);
	}
	fixture.approveWork("dependency", "board-dependency");
});

export const highPrioritySecond = fleetStory.trait("board", "the second item has high dispatch priority", (engine) => {
	const { fixture } = Option.getOrThrow(engine.runtime);
	fixture.priority("two", "high");
});

export const githubBacklog = fleetStory.trait("configuration", "GitHub PRs share a two-slot open-PR backlog", function* (engine) {
	const github = yield* mergedReviewGithub();
	engine.github = Option.some(github);
	engine.options = { ...github, backlog: 2 };
});

export const singlePrBacklog = fleetStory.trait("configuration", "the delivery backlog only admits one PR at a time", (engine) => {
	engine.options = { ...engine.options, backlog: 1 };
});
