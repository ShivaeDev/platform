import { Deferred, Effect, Fiber } from "effect";
import type { JobWithMetadata } from "pg-boss";
import type { QueueDefinition } from "#server/definition.ts";
import { failureOf } from "#test/failureOf.ts";
import type { DatabaseEngine } from "#test/postgres/databaseEngine.ts";
import { driveWorkers, wakeWorkers } from "#test/postgres/driveWorkers.ts";
import { admin, controllerWorking, until } from "#test/postgres/engine.ts";
import { deadLetterSources, idOf, testingOf } from "#test/postgres/verbs.ts";
import { untilWork } from "#test/workers.ts";

type Tell = (line: string) => void;

function patiently<A>(description: string, wait: Effect.Effect<A>) {
	return wait.pipe(Effect.timeoutOrElse({ duration: "20 seconds", orElse: () => Effect.die(new Error(`Gave up waiting until ${description}`)) }));
}

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
		untilFinished: (queue: Pick<QueueDefinition, "name">, count: number) => {
			tell(`wait until ${count} ${queue.name} attempts have finished`);
			return patiently(
				`${count} ${queue.name} attempts have finished`,
				untilWork(engine.work, () => {
					const ids = new Set(engine.work.attemptsOf(queue.name));
					return engine.work.finished.filter(({ id }) => ids.has(id)).length >= count ? true : undefined;
				}),
			);
		},
		untilIdle: (name: string) => {
			tell(`wait until the testing controller of ${name} reports idle`);
			return driveWorkers(
				engine,
				Effect.suspend(() => testingOf(engine, name).waitForIdle),
			).pipe(Effect.timeout("20 seconds"));
		},
		untilInterrupted: (queue: Pick<QueueDefinition, "name">, count: number) => {
			tell(`wait until ${count} ${queue.name} attempts were interrupted`);
			return patiently(
				`${count} ${queue.name} attempts were interrupted`,
				untilWork(engine.work, () => {
					const ids = new Set(engine.work.attemptsOf(queue.name));
					return engine.work.interrupted.filter(({ id }) => ids.has(id)).length >= count ? true : undefined;
				}),
			);
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
		untilLogged: (fragment: string) => {
			tell(`wait until a log line mentions "${fragment}"`);
			return patiently(
				`a log line mentions "${fragment}"`,
				untilWork(engine.work, () => (engine.logs.some(({ message }) => JSON.stringify(message).includes(fragment)) ? true : undefined)),
			);
		},
		untilPassed: (gate: string) => {
			tell(`wait until the work at the ${gate} gate has gone on`);
			return patiently(`the work at the ${gate} gate has gone on`, Deferred.await(engine.work.gate(gate).passed));
		},
		untilSettled: (queue: Pick<QueueDefinition, "name">, count: number) => {
			tell(`wait until ${count} ${queue.name} jobs have completed or failed`);
			return driveWorkers(
				engine,
				until(
					engine,
					`${count} ${queue.name} jobs have completed or failed`,
					Effect.gen(function* () {
						const client = yield* admin(engine);
						const stored = yield* Effect.promise(() => client.findJobs(queue.name));
						return stored.filter(({ state }) => state === "completed" || state === "failed").length >= count ? true : undefined;
					}),
				),
			);
		},
		untilWaiting: (gate: string) => {
			tell(`wait until a job waits at the ${gate} gate`);
			return Deferred.await(engine.work.gate(gate).entered).pipe(Effect.timeout("20 seconds"));
		},
	};
}
