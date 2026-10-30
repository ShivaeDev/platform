import { Clock, Deferred, Effect, Option, type Schema } from "effect";
import { SqlClient } from "effect/sql";
import type { JobWithMetadata, SendOptions } from "pg-boss";
import { transact } from "@shivaedev/sql/transact.ts";
import type { QueueDefinition } from "#definition.ts";
import { deadLetterQueueName } from "#health.ts";
import type { PgBossService } from "#service.ts";
import { failureOf } from "#test/failureOf.ts";
import type { Registration } from "#test/workers.ts";
import { untilWork } from "#test/workers.ts";
import type { PgBossTesting } from "#testing.ts";
import type { DatabaseEngine, StoryPayload } from "./databaseEngine.ts";
import { admin, provided, runningIn, type StartOptions, startRuntime, until } from "./engine.ts";

type Tell = (line: string) => void;

function patiently<A>(description: string, wait: Effect.Effect<A>) {
	return wait.pipe(Effect.timeoutOrElse({ duration: "20 seconds", orElse: () => Effect.die(new Error(`Gave up waiting until ${description}`)) }));
}

export interface Enqueue extends SendOptions {
	readonly as: string;
	readonly sameIdAs?: string;
	readonly underSpan?: string;
}

function described(value: unknown): unknown {
	if (value === undefined) {
		return "done";
	}
	return Option.isOption(value) ? Option.getOrElse(value, () => "nothing") : value;
}

export function answer<A, E, R>(engine: DatabaseEngine, effect: Effect.Effect<A, E, R>) {
	return effect.pipe(
		Effect.match({ onFailure: failureOf, onSuccess: described }),
		Effect.flatMap((answered) =>
			Effect.sync(() => {
				engine.answered = answered;
			}),
		),
	);
}

export function enqueueAs<const TPayload extends StoryPayload>(
	engine: DatabaseEngine,
	name: string,
	queue: QueueDefinition<string, TPayload>,
	payload: Schema.Schema.Type<TPayload>,
	{ as, sameIdAs, singletonKey, underSpan, ...options }: Enqueue,
) {
	return Effect.suspend(() => {
		const jobs = runningIn(engine, name).jobs;
		const id = sameIdAs === undefined ? options.id : idOf(engine, sameIdAs).id;
		const sendOptions = { ...options, ...(id === undefined ? {} : { id }) };
		const sending =
			singletonKey === undefined
				? jobs.enqueue(queue, payload, sendOptions)
				: jobs.enqueue({ ...queue, key: undefined }, payload, { ...sendOptions, singletonKey });
		const send = Effect.map(Effect.zip(Clock.currentTimeMillis, sending), ([at, sent]) => {
			if (Option.isSome(sent)) {
				engine.enqueuedAt.set(as, at);
				engine.labels.set(sent.value, as);
				engine.jobs.set(as, { id: sent.value, queue });
				return as;
			}
			return "nothing";
		});
		return answer(engine, provided(engine, name, underSpan === undefined ? send : send.pipe(Effect.withSpan(underSpan))));
	});
}

export function idOf(engine: DatabaseEngine, as: string) {
	const job = engine.jobs.get(as);
	if (job === undefined) {
		throw new Error(`No job was enqueued as ${as}`);
	}
	return job;
}

export function lookup(engine: DatabaseEngine, as: string) {
	return Effect.suspend(() => {
		const job = idOf(engine, as);
		const runtime = [...engine.runtimes.values()].at(-1);
		if (runtime === undefined) {
			return Effect.flatMap(admin(engine), (client) => Effect.promise(() => client.getJobById(job.queue.name, job.id))).pipe(
				Effect.map(Option.fromNullishOr),
			);
		}
		return runtime.jobs.getJob(job.queue, job.id);
	});
}

export const deadLetterSources = Effect.fnUntraced(function* (engine: DatabaseEngine, queue: string) {
	const client = yield* admin(engine);
	const copies = yield* Effect.promise(() => client.findJobs(deadLetterQueueName(queue)));
	return copies.map((copy: JobWithMetadata<unknown>) => engine.labels.get(copy.sourceId ?? "") ?? copy.sourceId ?? "no source");
});

export function testingOf(engine: DatabaseEngine, name: string): PgBossTesting {
	const testing = runningIn(engine, name).testing;
	if (testing === undefined) {
		throw new Error(`${name} runs without a testing controller`);
	}
	return testing;
}

export function runtimeVerbs(engine: DatabaseEngine, tell: Tell) {
	return {
		adminSends: (queue: string, data: object | null, { as, ...options }: Enqueue) => {
			tell(`another producer sends ${as} to ${queue} through pg-boss directly`);
			return Effect.gen(function* () {
				const client = yield* admin(engine);
				const id = yield* Effect.promise(() => client.send(queue, data, options));
				if (id !== null) {
					engine.labels.set(id, as);
				}
			});
		},
		answered: () => Effect.sync(() => engine.answered),
		ask: <A, E>(name: string, request: string, call: (jobs: PgBossService) => Effect.Effect<A, E>) => {
			tell(`${name} asks its jobs service to ${request}`);
			return Effect.suspend(() => answer(engine, provided(engine, name, call(runningIn(engine, name).jobs))));
		},
		askTesting: <A, E>(name: string, request: string, call: (testing: PgBossTesting) => Effect.Effect<A, E>) => {
			tell(`the testing controller of ${name} is asked to ${request}`);
			return Effect.suspend(() => answer(engine, call(testingOf(engine, name))));
		},
		enqueue: <const TPayload extends StoryPayload>(
			name: string,
			queue: QueueDefinition<string, TPayload>,
			payload: Schema.Schema.Type<TPayload>,
			options: Enqueue,
		) => {
			tell(`${name} enqueues ${options.as}${options.underSpan === undefined ? "" : ` under the ${options.underSpan} span`}`);
			return enqueueAs(engine, name, queue, payload, options);
		},
		enqueueInTransaction: <const TPayload extends StoryPayload>(
			name: string,
			queue: QueueDefinition<string, TPayload>,
			payload: Schema.Schema.Type<TPayload>,
			options: Enqueue,
			ending: "commits" | "rolls back",
		) => {
			tell(`${name} enqueues ${options.as} inside a SQL transaction that ${ending}`);
			const body = enqueueAs(engine, name, queue, payload, options).pipe(
				Effect.andThen(lookup(engine, options.as)),
				Effect.flatMap((job) =>
					Effect.sync(() => {
						engine.seenBeforeCommit = Option.isSome(job) ? job.value.state : "missing";
					}),
				),
				Effect.andThen(ending === "commits" ? Effect.void : Effect.fail("rolled back")),
			);
			return transact(body, { onSqlError: (error) => error }).pipe(Effect.provideService(SqlClient.SqlClient, engine.sql), Effect.ignore);
		},
		monitorPasses: (...queues: readonly string[]) => {
			tell(`a pg-boss monitor pass refreshes ${queues.join(" and ")}`);
			return Effect.flatMap(admin(engine), (client) =>
				Effect.forEach(queues, (queue) => Effect.promise(() => client.supervise(queue)), { discard: true }),
			);
		},
		open: (gate: string) => {
			tell(`the ${gate} gate opens`);
			return Deferred.succeed(engine.work.gate(gate).opened, undefined);
		},
		pollNow: (name: string, queue: Pick<QueueDefinition, "name">) => {
			tell(`the idle ${queue.name} workers of ${name} poll now`);
			return Effect.sync(() => {
				const poll = engine.pollers.get(name);
				for (const worker of runningIn(engine, name).client.getWipData?.() ?? []) {
					if (worker.name === queue.name && worker.count === 0) {
						poll?.(worker.id);
					}
				}
			});
		},
		retry: (name: string, as: string) => {
			tell(`${name} retries ${as}`);
			return Effect.suspend(() => {
				const job = idOf(engine, as);
				return answer(engine, provided(engine, name, runningIn(engine, name).jobs.retry(job.queue, job.id)));
			});
		},
		runDeferredNow: (name: string, queue: Pick<QueueDefinition, "name">) => {
			tell(`the testing controller of ${name} runs deferred ${queue.name} jobs now`);
			return Effect.suspend(() => testingOf(engine, name).runDeferredNow(queue));
		},
		start: (name: string, jobs: readonly Registration[], options?: StartOptions) => {
			tell(`${name} starts the jobs runtime`);
			return startRuntime(engine, name, jobs, options);
		},
		startup: (name: string) => Effect.sync(() => engine.startups.get(name) ?? "never started"),
		stop: (name: string) => {
			tell(`${name} stops`);
			return Effect.suspend(() => runningIn(engine, name).stop).pipe(Effect.tap(() => Effect.sync(() => engine.runtimes.delete(name))));
		},
	};
}

export function waitingVerbs(engine: DatabaseEngine, tell: Tell) {
	return {
		untilAttempts: (queue: Pick<QueueDefinition, "name">, count: number) => {
			tell(`wait until ${queue.name} has started ${count} attempts`);
			return patiently(
				`${queue.name} has started ${count} attempts`,
				untilWork(engine.work, () => (engine.work.attemptsOf(queue.name).length >= count ? true : undefined)),
			);
		},
		untilDeadLettered: (queue: Pick<QueueDefinition, "name">, count: number) => {
			tell(`wait until ${count} ${queue.name} jobs are dead-lettered`);
			return until(
				engine,
				`${count} ${queue.name} jobs are dead-lettered`,
				Effect.map(deadLetterSources(engine, queue.name), (sources) => (sources.length >= count ? sources : undefined)),
			);
		},
		untilDeferred: (name: string, queue: Pick<QueueDefinition, "name">, count: number) => {
			tell(`wait until ${name} holds ${count} deferred ${queue.name} jobs`);
			return until(
				engine,
				`${name} holds ${count} deferred ${queue.name} jobs`,
				Effect.suspend(() => testingOf(engine, name).deferred(queue)).pipe(Effect.map((waiting) => (waiting.length >= count ? waiting : undefined))),
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
			return Effect.suspend(() => testingOf(engine, name).waitForIdle).pipe(Effect.timeout("20 seconds"));
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
			return until(
				engine,
				`${as} is ${state}`,
				Effect.map(lookup(engine, as), (job) => (Option.getOrUndefined(job)?.state === state ? true : undefined)),
			);
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
			return until(
				engine,
				`${count} ${queue.name} jobs have completed or failed`,
				Effect.gen(function* () {
					const client = yield* admin(engine);
					const stored = yield* Effect.promise(() => client.findJobs(queue.name));
					return stored.filter(({ state }) => state === "completed" || state === "failed").length >= count ? true : undefined;
				}),
			);
		},
		untilWaiting: (gate: string) => {
			tell(`wait until a job waits at the ${gate} gate`);
			return Deferred.await(engine.work.gate(gate).entered).pipe(Effect.timeout("20 seconds"));
		},
	};
}
