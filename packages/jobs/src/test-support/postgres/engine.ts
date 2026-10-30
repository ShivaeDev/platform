import { Cause, Clock, Context, Deferred, Effect, Exit, Layer, Logger, Option, References, Scope } from "effect";
import { type Job, PgBoss, type WorkOptions } from "pg-boss";
import { WorkerRelease } from "@shivaedev/sql/WorkerRelease.ts";
import { defaultClientFactory, type PgBossClient } from "#client.ts";
import { PgBossError } from "#error.ts";
import { registrationName } from "#internal/register.ts";
import type { PgBossLayerOptions } from "#service.ts";
import { failureOf } from "#test/failureOf.ts";
import { ApplicationLog, Jobs, notifyWork, type Registration, registrations } from "#test/workers.ts";
import { makePgBossTesting, testRetryPolicy } from "#testing.ts";
import type { DatabaseEngine, Runtime } from "./databaseEngine.ts";

export type StartOptions = Omit<Partial<PgBossLayerOptions<readonly [], never>>, "jobs" | "onError"> & {
	readonly controller?: "production retries" | "test retries" | "none";
	readonly handsBatchesOver?: "by priority";
	readonly pausesCompletionAt?: string;
	readonly reportsErrors?: true;
};

function logMessage(message: unknown): unknown {
	const single = Array.isArray(message) && message.length === 1 ? message[0] : message;
	return single instanceof PgBossError ? failureOf(single) : single;
}

export function provided<A, E, R>(engine: DatabaseEngine, runtime: string, effect: Effect.Effect<A, E, R>) {
	const logger = Logger.make(({ logLevel, message }) => {
		const logged = logMessage(message);
		engine.logs.push({ level: logLevel, message: logged, runtime });
		engine.timeline.push(`${runtime}: ${String(logged)}`);
		notifyWork(engine.work);
	});
	const release = engine.release;
	const logged = effect.pipe(
		Effect.provide(Logger.layer([logger])),
		Effect.provideService(References.MinimumLogLevel, "Debug"),
		Effect.provideService(ApplicationLog, (line) => engine.timeline.push(line)),
		Effect.withTracer(engine.trace.tracer),
	);
	return release === undefined ? logged : Effect.provideService(logged, WorkerRelease, release.service);
}

function observeWakes(engine: DatabaseEngine, runtime: string, client: PgBossClient): PgBossClient {
	const notify = client.notifyWorker;
	if (notify === undefined) {
		return client;
	}
	const wakes: string[] = [];
	engine.wakes.set(runtime, wakes);
	engine.pollers.set(runtime, notify);
	Object.defineProperty(client, "notifyWorker", {
		configurable: true,
		value: (id: string) => {
			const busy = (client.getWipData?.().find((worker) => worker.id === id)?.count ?? 0) > 0;
			wakes.push(busy ? "busy worker" : "idle worker");
			return notify(id);
		},
	});
	return client;
}

// pg-boss returns a claimed batch in no particular order, so stories that name the job a batch reaches first sort it.
function sortBatches(client: PgBossClient): PgBossClient {
	const sorted = {
		work(this: PgBoss, name: string, options: WorkOptions, handler: (jobs: Job<unknown>[]) => Promise<unknown>) {
			return PgBoss.prototype.work.call(this, name, options, (jobs: Job<unknown>[]) =>
				handler([...jobs].sort((left, right) => priorityOf(right) - priorityOf(left))),
			);
		},
	};
	Object.defineProperty(client, "work", { configurable: true, value: sorted.work });
	return client;
}

function priorityOf(job: Job<unknown>): number {
	return "priority" in job && typeof job.priority === "number" ? job.priority : 0;
}

function pauseCompletion(engine: DatabaseEngine, client: PgBossClient, gate: string) {
	const db = client.getDb?.();
	if (db === undefined) {
		throw new TypeError("This pg-boss client exposes no database to pause");
	}
	const executeSql = db.executeSql.bind(db);
	let paused = false;
	db.executeSql = async (text, values) => {
		if (!paused && /SET completed_on = \S+, state = 'completed'/u.test(text.replace(/\s+/gu, " "))) {
			paused = true;
			const { entered, opened, passed } = engine.work.gate(gate);
			Deferred.doneUnsafe(entered, Effect.void);
			await Effect.runPromise(Deferred.await(opened));
			const result = await executeSql(text, values);
			Deferred.doneUnsafe(passed, Effect.void);
			return result;
		}
		return executeSql(text, values);
	};
}

export function testingFor(controller: StartOptions["controller"]) {
	if (controller === "none") {
		return undefined;
	}
	return makePgBossTesting(controller === "test retries" ? { retryPolicy: testRetryPolicy } : {});
}

export const startRuntime = Effect.fnUntraced(function* (
	engine: DatabaseEngine,
	name: string,
	jobs: readonly Registration[],
	options: StartOptions = {},
) {
	const { controller, handsBatchesOver, pausesCompletionAt, reportsErrors, ...layerOptions } = options;
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const testing = testingFor(controller);
	const factory = layerOptions.clientFactory ?? testing?.clientFactory ?? defaultClientFactory;
	let client: PgBossClient | undefined;
	const registered = registrations(engine.work, jobs);
	const layer = Jobs.layer({
		connectionString: engine.url,
		...layerOptions,
		clientFactory: (construct) => {
			const created = observeWakes(engine, name, factory(construct));
			client = handsBatchesOver === undefined ? created : sortBatches(created);
			if (pausesCompletionAt !== undefined) {
				pauseCompletion(engine, client, pausesCompletionAt);
			}
			return client;
		},
		jobs: registered,
		...(reportsErrors === true ? { onError: (error: Error) => Effect.sync(() => engine.reported.push(error.message)) } : {}),
	});
	const startedAt = yield* Clock.currentTimeMillis;
	const built = yield* provided(engine, name, Layer.buildWithScope(layer, scope)).pipe(Effect.exit);
	if (Exit.isFailure(built) || client === undefined) {
		const error = Exit.isFailure(built) ? Option.getOrUndefined(Cause.findErrorOption(built.cause)) : undefined;
		engine.startups.set(name, error === undefined ? "died" : failureOf(error));
		return;
	}
	yield* Scope.addFinalizer(
		scope,
		Effect.forEach(engine.work.gates.values(), ({ opened }) => Deferred.succeed(opened, undefined), { discard: true }),
	);
	if (testing !== undefined) {
		engine.controllers.push(testing);
	}
	engine.startups.set(name, "started");
	engine.runtimes.set(name, {
		client,
		jobs: Context.get(built.value, Jobs),
		queues: registered.map(registrationName),
		startedAt,
		stop: provided(engine, name, Scope.close(scope, Exit.void)),
		testing,
	});
});

export function runningIn(engine: DatabaseEngine, name: string): Runtime {
	const found = engine.runtimes.get(name);
	if (found === undefined) {
		throw new Error(`${name} is not running: ${engine.startups.get(name) ?? "it never started"}`);
	}
	return found;
}

export function anyRuntime(engine: DatabaseEngine): Runtime {
	const found = [...engine.runtimes.values()].at(-1);
	if (found === undefined) {
		throw new Error("No jobs runtime is running");
	}
	return found;
}

export const admin = Effect.fnUntraced(function* (engine: DatabaseEngine, schema = "pgboss") {
	const existing = engine.admins.get(schema);
	if (existing !== undefined) {
		return existing;
	}
	const client = new PgBoss({ connectionString: engine.url, schedule: false, schema, supervise: false });
	client.on("error", (error) => engine.logs.push({ level: "Error", message: error.message, runtime: "administrator" }));
	engine.admins.set(schema, client);
	yield* Effect.acquireRelease(
		Effect.promise(() => client.start()),
		() => Effect.promise(() => client.stop()),
	);
	return client;
});

export function until<A, R>(
	engine: DatabaseEngine,
	description: string,
	read: Effect.Effect<A | undefined, unknown, R>,
): Effect.Effect<A, unknown, R> {
	let changes = 0;
	let wake: (() => void) | undefined;
	function listener() {
		changes += 1;
		wake?.();
	}
	function workChangedSince(seen: number) {
		return Effect.callback<void>((resume) => {
			if (changes !== seen) {
				resume(Effect.void);
				return;
			}
			wake = () => resume(Effect.void);
			return Effect.sync(() => {
				wake = undefined;
			});
		});
	}
	const poll = Effect.gen(function* () {
		while (true) {
			const seen = changes;
			const controllers = [...engine.controllers];
			const revisions = yield* Effect.forEach(controllers, (testing) => testing.revision);
			const value = yield* read;
			if (value !== undefined) {
				return value;
			}
			yield* Effect.raceAll([
				workChangedSince(seen),
				...controllers.map((testing, index) => Effect.asVoid(testing.waitForChange(revisions[index] ?? 0))),
			]);
		}
	});
	return Effect.acquireUseRelease(
		Effect.sync(() => engine.work.changed.add(listener)),
		() => poll,
		() => Effect.sync(() => engine.work.changed.delete(listener)),
	).pipe(Effect.timeoutOrElse({ duration: "20 seconds", orElse: () => Effect.die(new Error(`Gave up waiting until ${description}`)) }));
}

export function labelOf(engine: DatabaseEngine, id: string | null | undefined): string {
	return id === null || id === undefined ? "none" : (engine.labels.get(id) ?? id);
}

export function errorOf(output: unknown): string {
	if (typeof output !== "object" || output === null) {
		return output === null || output === undefined ? "none" : String(output);
	}
	const fields = new Map(Object.entries(output));
	const tag = fields.get("_tag");
	const detail = fields.get("message") ?? fields.get("reason");
	if (typeof tag === "string") {
		return `${tag}: ${String(detail)}`;
	}
	if (typeof detail === "string") {
		return detail;
	}
	const value = fields.get("value");
	return value === undefined ? JSON.stringify(output) : errorOf(value);
}
