import { Deferred, Effect, Fiber } from "effect";
import type { JobWithMetadata } from "pg-boss";
import type { QueueDefinition } from "@shivaedev/jobs/server/definition.ts";
import { failureOf } from "#test/jobs/failureOf.ts";
import { untilWork } from "#test/jobs/workers.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { driveWorkers, wakeWorkers } from "./driveWorkers.ts";
import { controllerWorking, until } from "./engine.ts";
import { deadLetterSources, idOf, testingOf } from "./verbs.ts";

type Tell = (line: string) => void;

export function waitingVerbs(engine: DatabaseEngine, tell: Tell) {
	return {
		untilAttempts: (queue: Pick<QueueDefinition, "name">, count: number) => {
			tell(`wait until ${queue.name} has started ${count} attempts`);
			return patiently(
				`${queue.name} has started ${count} attempts`,
				driveWorkers(
					engine,
					untilWork(engine.work, () => (engine.work.attemptsOf(queue.name).length >= count ? true : undefined)),
				),
			);
		},
		untilDeadLettered: (queue: Pick<QueueDefinition, "name">, count: number) => {
			tell(`wait until ${count} ${queue.name} jobs are dead-lettered`);
			return driveWorkers(
				engine,
				until(
					engine,
					`${count} ${queue.name} jobs are dead-lettered`,
					Effect.map(deadLetterSources(engine, queue.name), (sources) => (sources.length >= count ? sources : undefined)),
				),
			);
		},
		untilDeferred: (name: string, queue: Pick<QueueDefinition, "name">, count: number) => {
			tell(`wait until ${name} holds ${count} deferred ${queue.name} jobs`);
			return driveWorkers(
				engine,
				until(
					engine,
					`${name} holds ${count} deferred ${queue.name} jobs`,
					Effect.suspend(() => testingOf(engine, name).deferred(queue)).pipe(
						Effect.map((waiting) => (waiting.length >= count ? waiting : undefined)),
					),
				),
			);
		},
		untilFetchesPass: (queue: Pick<QueueDefinition, "name">, count: number) => {
			tell(`wait until ${count} ${queue.name} worker ${count === 1 ? "fetch passes" : "fetches pass"}`);
			return Effect.gen(function* () {
				const wait = yield* controllerWorking(engine, queue.name)
					.fetchesPass(queue, count)
					.pipe(Effect.forkChild({ startImmediately: true }));
				wakeWorkers(engine, queue.name);
				yield* Effect.promise(() => engine.clock.tick(0));
				return yield* Fiber.join(wait);
			}).pipe(
				Effect.mapError((error) => new Error(failureOf(error))),
				Effect.orDie,
			);
		},
		untilIdle: (name: string) => {
			tell(`wait until the testing controller of ${name} reports idle`);
			return driveWorkers(
				engine,
				Effect.suspend(() => testingOf(engine, name).waitForIdle),
			).pipe(Effect.timeout("20 seconds"));
		},
		untilJob: (as: string, state: JobWithMetadata["state"]) => {
			tell(`wait until ${as} is ${state}`);
			return Effect.suspend(() => {
				const { id, queue } = idOf(engine, as);
				return driveWorkers(engine, controllerWorking(engine, queue.name).untilJob(queue, id, state)).pipe(
					Effect.mapError((error) => new Error(failureOf(error).replace(id, as))),
				);
			}).pipe(Effect.orDie, Effect.asVoid);
		},
		untilWaiting: (gate: string) => {
			tell(`wait until a job waits at the ${gate} gate`);
			return Deferred.await(engine.work.gate(gate).entered).pipe(Effect.timeout("20 seconds"));
		},
	};
}

function patiently<A>(description: string, wait: Effect.Effect<A>) {
	return wait.pipe(Effect.timeoutOrElse({ duration: "20 seconds", orElse: () => Effect.die(new Error(`Gave up waiting until ${description}`)) }));
}
