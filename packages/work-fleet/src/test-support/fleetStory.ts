import { Context, Effect, Layer, Option } from "effect";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import type { EngineOptions } from "#test/EngineOptions.ts";
import { type EngineFixture, makeEngine, prepareWork } from "#test/engine.ts";
import { PR, REPORT } from "#test/githubResult.ts";
import { mergedReviewGithub } from "#test/mergedReviewGithub.ts";
import { postgresStory } from "#test/postgres.ts";

interface Runtime {
	readonly fixture: EngineFixture;
	readonly fleet: typeof Fleet.Service;
}

export const fleetStory = storyKit({
	...postgresStory,
	after: {
		*configuration(engine) {
			const { fixture, layer } = yield* makeEngine(engine.options);
			const context = yield* Layer.build(layer);
			engine.runtime = Option.some({ fixture, fleet: Context.get(context, Fleet) });
		},
	},
	*create() {
		const github = yield* mergedReviewGithub();
		const options: EngineOptions = { ...github };
		return { github, options, runtime: Option.none<Runtime>() };
	},
	inspect: (engine) => ({ github: engine.github.state, launched: Option.getOrUndefined(engine.runtime)?.fixture.launched }),
	name: "fleet",
	stages: ["configuration", "work"],
	verbs: (engine, story) => {
		const { fixture, fleet } = Option.getOrThrow(engine.runtime);
		return {
			dispatch: (workId: string) => {
				story.tell(`Fleet tries to launch ${workId}`);
				return fleet.dispatch(workId);
			},
			finishWorker: Effect.fnUntraced(function* (workId: string) {
				story.tell(`the worker for ${workId} finishes with its PR report`);
				const record = yield* fleet.get(workId);
				const receipt = record.value.attempts.at(-1)?.receipt;
				const observation = receipt === undefined ? undefined : fixture.observations.get(receipt.turnId);
				if (observation === undefined) {
					return yield* Effect.die(`No worker turn to finish for ${workId}`);
				}
				fixture.observations.set(observation.receipt.turnId, { ...observation, execution: "completed", output: REPORT });
			}),
			get: fleet.get,
			launched: fixture.launched,
			observePr: (status: "CLOSED" | "MERGED") => {
				story.tell(`the PR is ${status.toLowerCase()} on GitHub`);
				engine.github.state.status = status;
			},
			prepare: (workId: string) => {
				story.tell(`Fleet prepares ${workId}`);
				return prepareWork(workId).pipe(Effect.provideService(Fleet, fleet));
			},
			reconcile: (workId: string) => {
				story.tell(`Fleet reconciles ${workId} through its existing observations`);
				return fleet.reconcile(workId);
			},
			reservations: fixture.foreignReservations,
			reservePr: () => {
				story.tell("the PR reserves execution capacity and open-PR backlog");
				return fixture.foreign(PR, { backlog: true, executing: true });
			},
			step: () => {
				story.tell("the scheduler reconciles active work and retries waiting work");
				return cycle.pipe(Effect.provideService(Fleet, fleet));
			},
		};
	},
});

export function limitedBy(kind: "execution" | "backlog") {
	return fleetStory.trait("configuration", `${kind} capacity is full while the foreign PR is reserved`, (engine) => {
		engine.options = { ...engine.options, backlog: kind === "backlog" ? 2 : 4, concurrency: kind === "execution" ? 1 : 4 };
	});
}
