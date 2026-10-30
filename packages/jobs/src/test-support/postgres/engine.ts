import { Cause, Clock, Context, Deferred, Effect, Exit, Layer, Logger, Option, References, Scope, Tracer } from "effect";
import { PgBoss } from "pg-boss";
import { WorkerRelease } from "@shivaedev/sql/WorkerRelease.ts";
import { defaultClientFactory, type PgBossClient } from "#client.ts";
import { PgBossError } from "#error.ts";
import { registrationName } from "#internal/register.ts";
import type { PgBossLayerOptions } from "#service.ts";
import { failureOf } from "#test/failureOf.ts";
import { ApplicationLog, Jobs, notifyWork, type Registration, registrations } from "#test/workers.ts";
import { makePgBossTesting, testRetryPolicy } from "#testing.ts";
import { observeStops, observeWakes, pauseCompletion, sortBatches } from "./clientObservers.ts";
import type { DatabaseEngine, Runtime } from "./databaseEngine.ts";

export type StartOptions = Omit<Partial<PgBossLayerOptions<readonly [], never>>, "jobs" | "onError"> & {
	readonly controller?: "production retries" | "test retries" | "none";
	readonly finalizesInParallel?: true;
	readonly handsBatchesOver?: "by priority";
	readonly pausesCompletionAt?: string;
	readonly reportsErrors?: true;
	readonly jobLookupsFailWith?: string;
	readonly startsUnderLogAnnotations?: Readonly<Record<string, string>>;
};

function logMessage(message: unknown, cause: Cause.Cause<unknown>): unknown {
	if (Array.isArray(message) && message.length === 0 && cause.reasons.length > 0) {
		const error = Cause.squash(cause);
		return error instanceof Error ? error.message : String(error);
	}
	const single = Array.isArray(message) && message.length === 1 ? message[0] : message;
	return single instanceof PgBossError ? failureOf(single) : single;
}

export function provided<A, E, R>(engine: DatabaseEngine, runtime: string, effect: Effect.Effect<A, E, R>) {
	const logger = Logger.make(({ cause, fiber, logLevel, message }) => {
		const logged = logMessage(message, cause);
		const span = Context.getOption(fiber.context, Tracer.ParentSpan);
		engine.logs.push({
			annotations: fiber.getRef(References.CurrentLogAnnotations),
			level: logLevel,
			message: logged,
			runtime,
			spanId: Option.isSome(span) ? span.value.spanId : undefined,
		});
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
	const {
		controller,
		finalizesInParallel,
		handsBatchesOver,
		pausesCompletionAt,
		reportsErrors,
		jobLookupsFailWith,
		startsUnderLogAnnotations,
		...layerOptions
	} = options;
	const story = yield* Scope.Scope;
	const scope = yield* Scope.fork(story, finalizesInParallel === true ? "parallel" : "sequential");
	const testing = testingFor(controller);
	const factory = layerOptions.clientFactory ?? testing?.clientFactory ?? defaultClientFactory;
	let client: PgBossClient | undefined;
	const registered = registrations(engine.work, jobs);
	const layer = Jobs.layer({
		connectionString: engine.url,
		...layerOptions,
		clientFactory: (construct) => {
			const created = observeStops(engine, observeWakes(engine, name, factory(construct)));
			client = handsBatchesOver === undefined ? created : sortBatches(created);
			if (pausesCompletionAt !== undefined) {
				pauseCompletion(engine, client, pausesCompletionAt);
			}
			if (jobLookupsFailWith !== undefined) {
				Object.defineProperty(client, "findJobs", { configurable: true, value: () => Promise.reject(new Error(jobLookupsFailWith)) });
			}
			if (layerOptions.clientCacheKey !== undefined) {
				engine.sharedClients.set(layerOptions.clientCacheKey, client);
			}
			return client;
		},
		jobs: registered,
		...(reportsErrors === true ? { onError: (error: Error) => Effect.sync(() => engine.reported.push(error.message)) } : {}),
	});
	const startedAt = yield* Clock.currentTimeMillis;
	const built = yield* provided(engine, name, Layer.buildWithScope(layer, scope)).pipe(
		Effect.annotateLogs(startsUnderLogAnnotations ?? {}),
		Effect.exit,
	);
	client ??= layerOptions.clientCacheKey === undefined ? undefined : engine.sharedClients.get(layerOptions.clientCacheKey);
	if (Exit.isFailure(built) || client === undefined) {
		const error = Exit.isFailure(built) ? Option.getOrUndefined(Cause.findErrorOption(built.cause)) : undefined;
		engine.startups.set(name, error === undefined ? "died" : failureOf(error));
		return;
	}
	// Held work is let go when the story ends, not when the runtime stops, so a story can watch a stop wait for it.
	yield* Scope.addFinalizer(
		story,
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
	client.on("error", (error) =>
		engine.logs.push({ annotations: {}, level: "Error", message: error.message, runtime: "administrator", spanId: undefined }),
	);
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
		return typeof detail === "string" && detail !== "" ? `${tag}: ${detail}` : tag;
	}
	if (typeof detail === "string") {
		return detail;
	}
	const value = fields.get("value");
	return value === undefined ? JSON.stringify(output) : errorOf(value);
}
