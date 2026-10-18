import type { TestContext, Vitest } from "@effect/vitest";
import type { Effect, Layer, Scope } from "effect";
import type { AnyTestLayer } from "@shivaedev/effect-test/anyTestLayer.ts";
import type { EffectClock, EffectTestOptions } from "@shivaedev/effect-test/types.ts";
import type { EffectTRPCAdapter } from "#server/adapter.ts";
import type { EffectCallerFactory } from "./caller.ts";
export type TrpcHarnessTest<THarness, TProvided> = <A, TEff extends Effect.Effect<unknown, unknown, TProvided>>(
	name: string,
	body: (harness: THarness, context: TestContext) => Generator<TEff, A, never>,
	options?: number | EffectTestOptions,
) => void;
export interface TrpcHarnessTester<THarness, TProvided> extends TrpcHarnessTest<THarness, TProvided> {
	readonly each: <TItem>(
		cases: readonly TItem[],
	) => <A, TEff extends Effect.Effect<unknown, unknown, TProvided>>(
		name: string,
		body: (item: TItem, harness: THarness, context: TestContext) => Generator<TEff, A, never>,
		options?: number | EffectTestOptions,
	) => void;
	readonly fails: TrpcHarnessTest<THarness, TProvided>;
	readonly only: TrpcHarnessTest<THarness, TProvided>;
	readonly runIf: (condition: unknown) => TrpcHarnessTest<THarness, TProvided>;
	readonly skip: TrpcHarnessTest<THarness, TProvided>;
	readonly skipIf: (condition: unknown) => TrpcHarnessTest<THarness, TProvided>;
}
export type TrpcTest<TOptions, TCaller, TProvided> = TrpcHarnessTest<EffectCallerFactory<TOptions, TCaller>, TProvided>;
export type TrpcTester<TOptions, TCaller, TProvided> = TrpcHarnessTester<EffectCallerFactory<TOptions, TCaller>, TProvided>;
export type TrpcIt<TOptions, TCaller, TProvided> = Vitest.Methods & {
	readonly "effectTRPC": TrpcTester<TOptions, TCaller, TProvided>;
};
export type TrpcHarnessIt<THarness, TProvided> = Vitest.Methods & {
	readonly "effectTRPC": TrpcHarnessTester<THarness, TProvided>;
};
export interface MakeTrpcItOptions<TCreateCaller extends (...arguments_: never[]) => object, TTestLayer extends AnyTestLayer> {
	readonly adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">;
	readonly around?: <A, E>(
		effect: Effect.Effect<A, E, Layer.Success<TTestLayer> | Scope.Scope>,
	) => Effect.Effect<A, unknown, Layer.Success<TTestLayer> | Scope.Scope>;
	readonly clock?: EffectClock;
	readonly createCaller: TCreateCaller;
	readonly layer: TTestLayer;
}
export interface MakeTrpcHarnessItOptions<TCreateCaller extends (...arguments_: never[]) => object, TTestLayer extends AnyTestLayer, THarness>
	extends MakeTrpcItOptions<TCreateCaller, TTestLayer> {
	readonly makeHarness: (
		trpc: EffectCallerFactory<CallerOptions<TCreateCaller>, CallerResult<TCreateCaller>>,
		context: TestContext,
	) => Effect.Effect<THarness, unknown, Layer.Success<TTestLayer>>;
}
export type CallerOptions<TCreateCaller> = TCreateCaller extends (...arguments_: infer TArguments) => object ? TArguments[0] : never;
export type CallerResult<TCreateCaller> = TCreateCaller extends (...arguments_: infer _TArguments) => infer TCaller
	? TCaller extends object
		? TCaller
		: never
	: never;
