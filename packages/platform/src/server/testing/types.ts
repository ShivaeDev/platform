import type { TestContext, Vitest } from "@effect/vitest";
import type { Effect, Layer } from "effect";
import type { AnyDatabase } from "@shivaedev/effect-prisma/databaseTypes.ts";
import type { DatabaseService } from "@shivaedev/effect-prisma/testing/types.ts";
import type { EffectTRPCAdapter } from "@shivaedev/effect-trpc/server/adapter.ts";
import type { EffectCallerFactory } from "@shivaedev/effect-trpc/server/testing/caller.ts";
import type { CallerOptions, CallerResult, TrpcHarnessTest, TrpcHarnessTester } from "@shivaedev/effect-trpc/server/testing/types.ts";
export type PlatformHarness<TDatabase extends AnyDatabase, TOptions, TCaller, TExtension> = Readonly<{
	db: DatabaseService<TDatabase>;
	trpc: EffectCallerFactory<TOptions, TCaller>;
}> &
	Readonly<{
		promise: <TValue>(evaluate: () => Promise<TValue>) => Effect.Effect<TValue, unknown>;
	}> &
	Omit<TExtension, "db" | "promise" | "trpc">;
export type PlatformTest<THarness, TProvided> = TrpcHarnessTest<THarness, TProvided>;
export type PlatformTester<THarness, TProvided> = TrpcHarnessTester<THarness, TProvided>;
export type PlatformIt<THarness, TProvided> = Vitest.Methods & {
	readonly effectApp: PlatformTester<THarness, TProvided>;
};
export interface MakePlatformItOptions<
	TDatabase extends AnyDatabase,
	TCreateCaller extends (...arguments_: never[]) => object,
	TProvided,
	TLayerError,
	TExtension,
> {
	readonly adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">;
	readonly createCaller: TCreateCaller;
	readonly extend?: (
		base: Readonly<{
			db: DatabaseService<TDatabase>;
			trpc: EffectCallerFactory<CallerOptions<NoInfer<TCreateCaller>>, CallerResult<NoInfer<TCreateCaller>>>;
		}>,
		context: TestContext,
	) => Effect.Effect<TExtension, unknown, TProvided | Effect.Services<TDatabase>>;
	readonly layer: Layer.Layer<TProvided, TLayerError>;
}
