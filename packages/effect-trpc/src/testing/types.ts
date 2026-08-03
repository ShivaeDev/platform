import type { TestContext, TestOptions, Vitest } from "@effect/vitest";
import type { Effect, Layer } from "effect";
import type { EffectTRPCAdapter } from "../adapter.js";
import type { EffectCallerFactory } from "./caller.js";

export type TrpcTest<Options, Caller, Provided> = <
	A,
	Eff extends Effect.Effect<unknown, unknown, Provided>,
>(
	name: string,
	body: (
		trpc: EffectCallerFactory<Options, Caller>,
		context: TestContext,
	) => Generator<Eff, A, never>,
	options?: number | TestOptions,
) => void;

export interface TrpcTester<Options, Caller, Provided>
	extends TrpcTest<Options, Caller, Provided> {
	readonly skip: TrpcTest<Options, Caller, Provided>;
	readonly skipIf: (condition: unknown) => TrpcTest<Options, Caller, Provided>;
	readonly runIf: (condition: unknown) => TrpcTest<Options, Caller, Provided>;
	readonly only: TrpcTest<Options, Caller, Provided>;
	readonly each: <Item>(
		cases: ReadonlyArray<Item>,
	) => <A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
		name: string,
		body: (
			item: Item,
			trpc: EffectCallerFactory<Options, Caller>,
			context: TestContext,
		) => Generator<Eff, A, never>,
		options?: number | TestOptions,
	) => void;
	readonly fails: TrpcTest<Options, Caller, Provided>;
}

export type TrpcIt<Options, Caller, Provided> = Vitest.Methods & {
	readonly effectTRPC: TrpcTester<Options, Caller, Provided>;
};

export interface TrpcTestRuntimeOptions<
	Options,
	Caller extends object,
	Provided,
	LayerError,
> {
	readonly adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">;
	readonly around?: <A, E>(
		effect: Effect.Effect<A, E, Provided>,
	) => Effect.Effect<A, unknown, Provided>;
	readonly createCaller: (options?: Options) => Caller;
	readonly layer: Layer.Layer<Provided, LayerError>;
}

export interface MakeTrpcItOptions<
	CreateCaller extends (...arguments_: never[]) => object,
	// biome-ignore lint/suspicious/noExplicitAny: Layer output and error are recovered with Layer utility types
	TestLayer extends Layer.Layer<any, any, never>,
> {
	readonly adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">;
	readonly around?: <A, E>(
		effect: Effect.Effect<A, E, Layer.Success<TestLayer>>,
	) => Effect.Effect<A, unknown, Layer.Success<TestLayer>>;
	readonly createCaller: CreateCaller;
	readonly layer: TestLayer;
}

export type CallerOptions<CreateCaller> = CreateCaller extends (
	...arguments_: infer Arguments
) => object
	? Arguments[0]
	: never;

export type CallerResult<CreateCaller> = CreateCaller extends (
	...arguments_: infer _Arguments
) => infer Caller
	? Caller extends object
		? Caller
		: never
	: never;
