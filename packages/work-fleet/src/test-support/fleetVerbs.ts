import { Context, Effect, Layer, Option } from "effect";
import { CommittedSink } from "@shivaedev/effect-sql/transact.ts";
import { cycle } from "#engine/scheduler.ts";
import { Fleet } from "#fleet.ts";
import { boardItemVerbs } from "#test/boardItemVerbs.ts";
import { finishWorkers } from "#test/engine.ts";
import type { FleetStoryState } from "#test/fleetStoryState.ts";
import { foreignPrVerbs } from "#test/foreignPrVerbs.ts";
import { prepared } from "#test/preparation.ts";

export function fleetVerbs(engine: FleetStoryState, story: { readonly tell: (message: string) => void }) {
	const runtime = Option.getOrThrow(engine.runtime);
	const { fixture } = runtime;
	return {
		...boardItemVerbs(engine, story),
		...foreignPrVerbs(fixture, runtime.fleet, engine.github, story),
		attemptContinue: (id: string, message: string) => {
			story.tell(`Fleet attempts to continue ${id}`);
			return runtime.fleet.continue(id, message).pipe(
				Effect.matchEffect({
					onFailure: Effect.succeed,
					onSuccess: () => Effect.die(new Error(`Expected continuing ${id} to fail, but it succeeded`)),
				}),
			);
		},
		attemptDispatch: (id: string) => {
			story.tell(`Fleet attempts to dispatch ${id}`);
			return runtime.fleet.dispatch(id).pipe(
				Effect.matchEffect({
					onFailure: Effect.succeed,
					onSuccess: () => Effect.die(new Error(`Expected dispatching ${id} to fail, but it succeeded`)),
				}),
			);
		},
		commits: engine.commits,
		continue: (id: string, message: string) => {
			story.tell(`Fleet continues ${id}`);
			return runtime.fleet.continue(id, message);
		},
		dependencies: (id: string, targets: readonly string[]) => {
			story.tell(`${id} now depends on ${targets.join(", ") || "no other work"}`);
			fixture.dependencies(id, targets);
		},
		dispatch: (id: string) => {
			story.tell(`Fleet dispatches ${id}`);
			return runtime.fleet.dispatch(id);
		},
		finishWorkers: () => {
			story.tell("the provider reports that the active turns completed");
			finishWorkers(fixture);
		},
		get: (id: string) => runtime.fleet.get(id),
		prepare: (id: string) => {
			story.tell(`Fleet prepares ${id}`);
			return runtime.fleet.prepare({
				cwd: "/synthetic",
				preparation: prepared({ ownedPaths: [`src/${id}.ts`] }),
				prompt: `Implement ${id}`,
				workId: id,
			});
		},
		rebuild: () =>
			Effect.gen(function* () {
				story.tell("Fleet rebuilds its runtime against saved records");
				runtime.fleet = Context.get(yield* Layer.build(Layer.fresh(runtime.fleetLayer)), Fleet);
			}),
		reconcile: (id: string) => {
			story.tell(`Fleet reconciles ${id}`);
			return runtime.fleet.reconcile(id).pipe(Effect.provideService(CommittedSink, (changes) => Effect.sync(() => engine.commits.push(changes))));
		},
		recordedSchedulerLogs: () => engine.logs.entries,
		schedule: () => {
			story.tell("Fleet runs a scheduler pass");
			return cycle.pipe(Effect.provideService(Fleet, runtime.fleet), Effect.provide(engine.logs.layer));
		},
		unavailableWork: (id: string, unavailable: boolean) => {
			story.tell(`Board reads for ${id} are ${unavailable ? "unavailable" : "available"}`);
			fixture.unavailableWork(id, unavailable);
		},
		workerQuestion: (id: string, question: string) =>
			Effect.gen(function* () {
				story.tell(`the worker for ${id} finishes its turn with a question`);
				const receipt = (yield* runtime.fleet.get(id)).value.attempts.at(-1)?.receipt;
				const observation = receipt === undefined ? undefined : fixture.observations.get(receipt.turnId);
				if (observation === undefined) {
					return yield* Effect.die(new Error(`Missing worker observation for ${id}`));
				}
				fixture.observations.set(observation.receipt.turnId, { ...observation, execution: "completed", output: `FLEET_QUESTION: ${question}` });
			}),
	};
}
