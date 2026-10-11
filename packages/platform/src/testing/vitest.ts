import type { TestContext } from "@effect/vitest";
import { Effect, type Layer } from "effect";
import type { AnyDatabase } from "@shivaedev/effect-prisma/databaseTypes.ts";
import { withTestTransaction } from "@shivaedev/effect-prisma/testing/transaction.ts";
import type { EffectTRPCAdapter } from "@shivaedev/effect-trpc/adapter.ts";
import type { EffectCallerFactory } from "@shivaedev/effect-trpc/testing/caller.ts";
import type { CallerOptions, CallerResult } from "@shivaedev/effect-trpc/testing/types.ts";
import { makeTrpcHarnessIt } from "@shivaedev/effect-trpc/testing/vitest.ts";
import type { Bivariant } from "@shivaedev/types/bivariant.ts";
import type { MakePlatformItOptions, PlatformHarness, PlatformIt } from "./types.ts";

interface LooseOptions {
	readonly adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">;
	readonly createCaller: (options?: unknown) => object;
	extend?: Bivariant<
		(
			base: { readonly db: unknown; readonly trpc: EffectCallerFactory<unknown, object> },
			context: TestContext,
		) => Effect.Effect<object, unknown, unknown>
	>;
	readonly layer: Layer.Layer<unknown, unknown>;
}

function platformIt<
	TDatabase extends AnyDatabase,
	TCreateCaller extends (...arguments_: never[]) => object,
	TProvided,
	TLayerError,
	TExtension extends object,
>(
	database: TDatabase,
	options: MakePlatformItOptions<TDatabase, TCreateCaller, TProvided, TLayerError, TExtension> & {
		readonly layer: Layer.Layer<TProvided | Effect.Services<TDatabase>, TLayerError>;
	},
): PlatformIt<
	PlatformHarness<TDatabase, CallerOptions<TCreateCaller>, CallerResult<TCreateCaller>, TExtension>,
	TProvided | Effect.Services<TDatabase>
>;
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
				const promise = <TValue>(evaluate: () => Promise<TValue>) => Effect.tryPromise(() => options.adapter.runWithServices(services, evaluate));
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
	<const TDatabase extends AnyDatabase>(database: TDatabase) =>
	<TCreateCaller extends (...arguments_: never[]) => object, TProvided, TLayerError, TExtension extends object = Record<never, never>>(
		options: MakePlatformItOptions<TDatabase, TCreateCaller, TProvided, TLayerError, TExtension> & {
			readonly layer: Layer.Layer<TProvided | Effect.Services<TDatabase>, TLayerError>;
		},
	): PlatformIt<
		PlatformHarness<TDatabase, CallerOptions<TCreateCaller>, CallerResult<TCreateCaller>, TExtension>,
		TProvided | Effect.Services<TDatabase>
	> =>
		platformIt(database, options);
