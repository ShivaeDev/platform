import type { TestContext } from "@effect/vitest";
import { type AnyDatabase, withTestTransaction } from "@shivaedev/effect-prisma/testing";
import type { EffectTRPCAdapter } from "@shivaedev/effect-trpc";
import { type CallerOptions, type CallerResult, type EffectCallerFactory, makeTrpcHarnessIt } from "@shivaedev/effect-trpc/testing";
import { Effect, type Layer } from "effect";
import type { MakePlatformItOptions, PlatformHarness, PlatformIt } from "./types.ts";

interface LooseOptions {
	readonly adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">;
	readonly createCaller: (options?: unknown) => object;
	extend?(
		base: { readonly db: unknown; readonly trpc: EffectCallerFactory<unknown, object> },
		context: TestContext,
	): Effect.Effect<object, unknown, unknown>;
	readonly layer: Layer.Layer<unknown, unknown>;
}

function platformIt<
	Database extends AnyDatabase,
	CreateCaller extends (...arguments_: never[]) => object,
	Provided,
	LayerError,
	Extension extends object,
>(
	database: Database,
	options: MakePlatformItOptions<Database, CreateCaller, Provided, LayerError, Extension> & {
		readonly layer: Layer.Layer<Provided | Effect.Services<Database>, LayerError>;
	},
): PlatformIt<PlatformHarness<Database, CallerOptions<CreateCaller>, CallerResult<CreateCaller>, Extension>, Provided | Effect.Services<Database>>;
function platformIt(database: AnyDatabase, options: LooseOptions): unknown {
	const trpcIt = makeTrpcHarnessIt({
		adapter: options.adapter,
		around: (effect) => withTestTransaction(database, effect),
		createCaller: options.createCaller,
		layer: options.layer,
		makeHarness: (trpc, context) =>
			Effect.gen(function* () {
				const services = yield* Effect.context<unknown>();
				const db = yield* database;
				const extension = options.extend ? yield* options.extend({ db, trpc }, context) : {};
				const promise = <Value>(evaluate: () => Promise<Value>) => Effect.tryPromise(() => options.adapter.runWithServices(services, evaluate));
				return { ...extension, db, promise, trpc };
			}),
	});

	return new Proxy(trpcIt, {
		get(target, property, receiver) {
			if (property === "effectApp") {
				return trpcIt.effectTRPC;
			}
			return Reflect.get(target, property, receiver);
		},
	});
}

export const makePlatformIt =
	<const Database extends AnyDatabase>(database: Database) =>
	<CreateCaller extends (...arguments_: never[]) => object, Provided, LayerError, Extension extends object = Record<never, never>>(
		options: MakePlatformItOptions<Database, CreateCaller, Provided, LayerError, Extension> & {
			readonly layer: Layer.Layer<Provided | Effect.Services<Database>, LayerError>;
		},
	): PlatformIt<
		PlatformHarness<Database, CallerOptions<CreateCaller>, CallerResult<CreateCaller>, Extension>,
		Provided | Effect.Services<Database>
	> =>
		platformIt(database, options);
