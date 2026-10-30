import { Cause, Context, Effect, Exit, Layer, Logger, Option, References, Scope } from "effect";
import type { ConstructorOptions } from "pg-boss";
import type { PgBossClientFactory } from "#client.ts";
import { PgBossError } from "#error.ts";
import type { PgBossLayerOptions, PgBossService } from "#service.ts";
import { failureOf } from "#test/failureOf.ts";
import { FakeClient } from "#test/fakeClient.ts";
import { recordingTracer } from "#test/recordingTracer.ts";
import { ApplicationLog, Jobs, type Registration, registrations, type WorkLog, workLog } from "#test/workers.ts";

export type Options = Partial<PgBossLayerOptions<readonly [], never>>;

export interface Fetched {
	readonly data?: unknown;
	readonly expireInSeconds?: number;
	readonly id: string;
	readonly retryCount?: number;
	readonly startedMillisAgo?: number;
}

interface RunningRuntime {
	readonly jobs: PgBossService;
	readonly stop: Effect.Effect<void>;
}

export interface RuntimeEngine {
	answered: unknown;
	readonly applicationLog: string[];
	batchAnswer: string;
	client: FakeClient;
	clientsConstructed: number;
	factory: PgBossClientFactory;
	readonly failureMessages: Map<string, string>;
	readonly logs: { readonly level: string; readonly message: unknown }[];
	options: Options;
	readonly pending: Effect.Effect<void>[];
	releaseStart: ((failure: unknown) => void) | undefined;
	reporting: boolean;
	returnedAfterDeadline: number;
	readonly runtimes: Map<string, RunningRuntime>;
	readonly startups: Map<string, string>;
	readonly trace: ReturnType<typeof recordingTracer>;
	readonly work: WorkLog;
}

export function runtimeEngine(): RuntimeEngine {
	const client = new FakeClient();
	return {
		answered: undefined,
		applicationLog: [],
		batchAnswer: "not delivered",
		client,
		clientsConstructed: 0,
		factory: () => client,
		failureMessages: new Map(),
		logs: [],
		options: {},
		pending: [],
		releaseStart: undefined,
		reporting: false,
		returnedAfterDeadline: Number.NaN,
		runtimes: new Map(),
		startups: new Map(),
		trace: recordingTracer(),
		work: workLog(),
	};
}

function logMessage(message: unknown): unknown {
	const single = Array.isArray(message) && message.length === 1 ? message[0] : message;
	return single instanceof PgBossError ? failureOf(single) : single;
}

export function described(value: unknown): unknown {
	return Option.isOption(value) ? Option.getOrElse(value, () => "nothing") : value;
}

export function provided<A, E, R>(engine: RuntimeEngine, effect: Effect.Effect<A, E, R>) {
	const logger = Logger.layer([Logger.make(({ logLevel, message }) => engine.logs.push({ level: logLevel, message: logMessage(message) }))]);
	return effect.pipe(
		Effect.provide(logger),
		Effect.provideService(References.MinimumLogLevel, "Debug"),
		Effect.provideService(ApplicationLog, (line) => engine.applicationLog.push(line)),
		Effect.withTracer(engine.trace.tracer),
	);
}

export const startRuntime = Effect.fnUntraced(function* (engine: RuntimeEngine, name: string, jobs: readonly Registration[], options: Options = {}) {
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const factory = options.clientFactory ?? engine.factory;
	const layer = Jobs.layer({
		connectionString: "postgresql://fake",
		schema: "jobs_fake",
		...engine.options,
		...options,
		clientFactory: (clientOptions: ConstructorOptions) => {
			engine.clientsConstructed += 1;
			return factory(clientOptions);
		},
		jobs: registrations(engine.work, jobs),
		...(engine.reporting
			? { onError: (error: Error) => Effect.flatMap(ApplicationLog, (note) => Effect.sync(() => note(`onError: ${error.message}`))) }
			: {}),
	});
	const built = yield* provided(engine, Layer.buildWithScope(layer, scope)).pipe(Effect.exit);
	if (Exit.isFailure(built)) {
		const error = Option.getOrUndefined(Cause.findErrorOption(built.cause));
		engine.startups.set(name, error === undefined ? "died" : failureOf(error));
		engine.failureMessages.set(name, error instanceof Error ? error.message : String(error));
		return;
	}
	engine.startups.set(name, "started");
	engine.runtimes.set(name, { jobs: Context.get(built.value, Jobs), stop: provided(engine, Scope.close(scope, Exit.void)) });
});

export function runningIn(engine: RuntimeEngine, name: string) {
	const found = engine.runtimes.get(name);
	if (found === undefined) {
		throw new Error(`${name} is not running: ${engine.startups.get(name) ?? "it never started"}`);
	}
	return found;
}
