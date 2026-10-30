import { Effect, type Schema } from "effect";
import type { JobInsert } from "pg-boss";
import type { QueueDefinition } from "#definition.ts";
import { expireAttempt } from "#internal/expireAttempt.ts";
import type { Registration } from "#test/workers.ts";
import type { PgBossTesting } from "#testing.ts";
import { serverTlsAbsent } from "./connections.ts";
import { countIdleReads, startIdleWait, watchChange } from "./controller.ts";
import { database } from "./database.ts";
import type { StoryPayload } from "./databaseEngine.ts";
import { disconnectGate } from "./disconnectGate.ts";
import { admin, runningIn, type StartOptions, startRuntime } from "./engine.ts";
import { type Enqueue, enqueueAs, idOf, runtimeVerbs, testingOf, waitingVerbs } from "./verbs.ts";

const started = Effect.fnUntraced(function* (
	engine: Parameters<typeof startRuntime>[0],
	name: string,
	jobs: readonly Registration[],
	options?: StartOptions,
) {
	yield* startRuntime(engine, name, jobs, options);
	const answer = engine.startups.get(name);
	if (answer !== "started") {
		return yield* Effect.die(new Error(`${name} did not start: ${answer}`));
	}
});

export function running(name: string, jobs: readonly Registration[] = [], options?: StartOptions) {
	return database.trait("runtime", `${name} runs the jobs runtime`, (engine) => started(engine, name, jobs, options));
}

export function joined(name: string, jobs: readonly Registration[] = [], options?: StartOptions) {
	return database.trait("jobs", `${name} has since started the jobs runtime`, (engine) => started(engine, name, jobs, options));
}

export function stoppedAfterwards(name: string) {
	return database.trait("afterwards", `${name} has stopped since`, function* (engine) {
		yield* runningIn(engine, name).stop;
		engine.runtimes.delete(name);
	});
}

export interface EnqueuedBy extends Enqueue {
	readonly by?: string;
}

export function enqueued<const TPayload extends StoryPayload>(
	queue: QueueDefinition<string, TPayload>,
	payload: Schema.Schema.Type<TPayload>,
	{ by: name = "app", ...options }: EnqueuedBy,
) {
	return database.trait("jobs", `${name} enqueued ${options.as}`, function* (engine) {
		yield* enqueueAs(engine, name, queue, payload, options);
		if (engine.answered !== options.as) {
			return yield* Effect.die(new Error(`${options.as} was not enqueued: ${String(engine.answered)}`));
		}
	});
}

export function enqueuedUntil<const TPayload extends StoryPayload>(
	queue: QueueDefinition<string, TPayload>,
	payload: Schema.Schema.Type<TPayload>,
	{ by: name = "app", ...options }: EnqueuedBy,
	state: "completed" | "failed",
) {
	return database.trait("jobs", `${name} enqueued ${options.as}, which has ${state}`, function* (engine) {
		yield* enqueueAs(engine, name, queue, payload, options);
		yield* waitingVerbs(engine, () => undefined).untilJob(options.as, state);
	});
}

export function reached(as: string, state: "active" | "completed" | "failed" | "retry") {
	return database.trait("jobs", `${as} is ${state}`, (engine) => waitingVerbs(engine, () => undefined).untilJob(as, state));
}

export function interrupted(queue: Pick<QueueDefinition, "name">, count: number) {
	return database.trait("jobs", `${count} ${queue.name} attempt${count === 1 ? " was" : "s were"} interrupted`, (engine) =>
		waitingVerbs(engine, () => undefined).untilInterrupted(queue, count),
	);
}

export function waiting(gate: string, line = `a job waits at the ${gate} gate`) {
	return database.trait("jobs", line, (engine) => waitingVerbs(engine, () => undefined).untilWaiting(gate));
}

export function storedTogether<const TPayload extends StoryPayload>(
	queue: QueueDefinition<string, TPayload>,
	rows: readonly (JobInsert<TPayload["Encoded"]> & { readonly as: string })[],
) {
	return database.trait("database", `pg-boss already stores ${rows.map(({ as }) => as).join(", ")} in ${queue.name}`, function* (engine) {
		const client = yield* admin(engine);
		const ids = yield* Effect.promise(async () => {
			await client.createQueue(queue.name, queue.queueOptions);
			return client.insert(
				queue.name,
				rows.map(({ as: _label, ...row }) => row),
				{ returnId: true },
			);
		});
		for (const [index, row] of rows.entries()) {
			const id = ids?.[index];
			if (id === undefined) {
				return yield* Effect.die(new Error(`pg-boss stored no id for ${row.as}`));
			}
			engine.labels.set(id, row.as);
			engine.jobs.set(row.as, { id, queue });
		}
	});
}

export function clientStoppedUnderneath(name: string, queue: string) {
	return database.trait("afterwards", `the pg-boss client under ${name} has stopped on its own`, (engine) =>
		Effect.promise(async () => {
			const client = runningIn(engine, name).client;
			await client.offWork(queue);
			await client.stop();
		}),
	);
}

export function deletedOutside(...queues: readonly string[]) {
	return database.trait("afterwards", `an operator deleted ${queues.join(" and ")} through pg-boss directly`, function* (engine) {
		const client = yield* admin(engine);
		for (const queue of queues) {
			yield* Effect.promise(() => client.deleteQueue(queue));
		}
	});
}

export function enqueuedEarlier<const TPayload extends StoryPayload>(
	queue: QueueDefinition<string, TPayload>,
	payload: Schema.Schema.Type<TPayload>,
	options: Enqueue,
) {
	return database.trait("database", `a producer that has stopped since enqueued ${options.as}`, function* (engine) {
		yield* started(engine, "earlier producer", [queue]);
		yield* enqueueAs(engine, "earlier producer", queue, payload, options);
		yield* runningIn(engine, "earlier producer").stop;
		engine.runtimes.delete("earlier producer");
	});
}

export const noServerTls = database.trait("database", "the shared PostgreSQL serves no TLS", serverTlsAbsent);

export interface Holdings {
	readonly active: number;
	readonly failed: number;
	readonly later: number;
	readonly ready: number;
}

export function holds(queue: Pick<QueueDefinition, "name">, { active, failed, later, ready }: Holdings) {
	const line = `pg-boss holds ${failed} failed, ${active} active, ${ready} ready and ${later} later ${queue.name} jobs`;
	return database.trait("jobs", line, function* (engine) {
		const client = yield* admin(engine);
		yield* Effect.promise(async () => {
			for (let index = 0; index < failed; index += 1) {
				await client.send(queue.name, {});
			}
			const claimed = await client.fetch(queue.name, { batchSize: failed, includeMetadata: true });
			await client.fail(queue.name, claimed, new Error("Retained health failure"));
			for (let index = 0; index < active; index += 1) {
				await client.send(queue.name, {});
			}
			await client.fetch(queue.name, { batchSize: active });
			for (let index = 0; index < ready + later; index += 1) {
				await client.send(queue.name, {}, index < ready ? {} : { startAfter: 3600 });
			}
		});
	});
}

export function deferred(queue: Pick<QueueDefinition, "name">, count: number, name = "app") {
	return database.trait("jobs", `${name} holds ${count} deferred ${queue.name} job${count === 1 ? "" : "s"}`, (engine) =>
		waitingVerbs(engine, () => undefined).untilDeferred(name, queue, count),
	);
}

export function ranDeferredNow(queue: Pick<QueueDefinition, "name">, name = "app") {
	return database.trait("jobs", `the testing controller of ${name} ran deferred ${queue.name} jobs now`, (engine) =>
		runtimeVerbs(engine, () => undefined).runDeferredNow(name, queue),
	);
}

export function deletedJob(as: string) {
	return database.trait("jobs", `an operator deleted ${as} through pg-boss directly`, function* (engine) {
		const client = yield* admin(engine);
		const { id, queue } = idOf(engine, as);
		yield* Effect.promise(() => client.deleteJob(queue.name, id));
	});
}

export function claimedAndExpired(as: string, cause: "expiry" | "heartbeat") {
	return database.trait(
		"afterwards",
		`another worker claimed ${as} once it was due, and the claim hit a native ${cause} timeout`,
		function* (engine) {
			const client = yield* admin(engine);
			const { id, queue } = idOf(engine, as);
			yield* Effect.promise(async () => {
				await client.update(queue.name, {}, { id, startAfter: 0 });
				const [claim] = await client.fetch(queue.name, { includeMetadata: true });
				if (claim?.id !== id) {
					throw new Error(`${as} was not available to claim`);
				}
				await expireAttempt(client, "pgboss", claim, cause);
			});
		},
	);
}

export function controlled(call: (testing: PgBossTesting) => Effect.Effect<unknown, unknown>, request: string, name = "app") {
	return database.trait("jobs", `the testing controller of ${name} was asked to ${request}`, (engine) =>
		Effect.suspend(() => call(testingOf(engine, name))),
	);
}

export function sent<const TPayload extends StoryPayload>(
	queue: QueueDefinition<string, TPayload>,
	payload: Schema.Schema.Type<TPayload>,
	{ by: name = "app", ...options }: EnqueuedBy,
) {
	return database.trait("jobs", `${name} tried to enqueue ${options.as}`, (engine) => enqueueAs(engine, name, queue, payload, options));
}

export function claimedElsewhere(as: string) {
	return database.trait("jobs", `another worker has claimed ${as}`, function* (engine) {
		const client = yield* admin(engine);
		const { id, queue } = idOf(engine, as);
		const [claim] = yield* Effect.promise(() => client.fetch(queue.name));
		if (claim?.id !== id) {
			return yield* Effect.die(new Error(`${as} was not available to claim`));
		}
	});
}

export function idleReadsCounted(name: string, gate: string) {
	return database.trait("runtime", `the idle reads of ${name} are counted against the ${gate} gate`, (engine) => countIdleReads(engine, name, gate));
}

export function idleWaitStarted(name: string) {
	return database.trait("jobs", `the testing controller of ${name} has started waiting for idle`, (engine) => startIdleWait(engine, name));
}

export function watchingForChange(name: string) {
	return database.trait("jobs", `the testing controller of ${name} is waiting for a change`, (engine) => watchChange(engine, name, "now"));
}

export const disconnectGated = database.trait(
	"database",
	"a disconnect gate in front of PostgreSQL holds each disconnect acknowledgement",
	(engine) =>
		Effect.map(
			Effect.acquireRelease(
				Effect.promise(() => disconnectGate(engine.url)),
				(gate) => Effect.promise(gate.close),
			),
			(gate) => {
				engine.gate = gate;
			},
		),
);

export function runningBehindGate(name: string, options: StartOptions) {
	return database.trait("runtime", `${name} runs the jobs runtime through the disconnect gate`, (engine) =>
		Effect.suspend(() =>
			started(engine, name, [], {
				...options,
				"application_name": name,
				"connectionString": engine.gate?.url ?? engine.url,
				"schedule": false,
				"supervise": false,
			}),
		),
	);
}
