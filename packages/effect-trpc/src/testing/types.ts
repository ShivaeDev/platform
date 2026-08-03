import type { TestContext, TestOptions, Vitest } from "@effect/vitest";
import type { Effect, Layer } from "effect";
import type { EffectTRPCAdapter } from "../adapter.js";
import type { EffectCallerFactory } from "./caller.js";

export type TrpcHarnessTest<Harness, Provided> = <
	A,
	Eff extends Effect.Effect<unknown, unknown, Provided>,
>(
	name: string,
	body: (harness: Harness, context: TestContext) => Generator<Eff, A, never>,
	options?: number | TestOptions,
) => void;

export interface TrpcHarnessTester<Harness, Provided>
	extends TrpcHarnessTest<Harness, Provided> {
	readonly skip: TrpcHarnessTest<Harness, Provided>;
	readonly skipIf: (condition: unknown) => TrpcHarnessTest<Harness, Provided>;
	readonly runIf: (condition: unknown) => TrpcHarnessTest<Harness, Provided>;
	readonly only: TrpcHarnessTest<Harness, Provided>;
	readonly each: <Item>(
		cases: ReadonlyArray<Item>,
	) => <A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
		name: string,
		body: (
			item: Item,
			harness: Harness,
			context: TestContext,
		) => Generator<Eff, A, never>,
		options?: number | TestOptions,
	) => void;
	readonly fails: TrpcHarnessTest<Harness, Provided>;
}

export type TrpcTest<Options, Caller, Provided> = TrpcHarnessTest<
	EffectCallerFactory<Options, Caller>,
	Provided
>;

export type TrpcTester<Options, Caller, Provided> = TrpcHarnessTester<
	EffectCallerFactory<Options, Caller>,
	Provided
>;

export type TrpcIt<Options, Caller, Provided> = Vitest.Methods & {
	readonly effectTRPC: TrpcTester<Options, Caller, Provided>;
};

export type TrpcHarnessIt<Harness, Provided> = Vitest.Methods & {
	readonly effectTRPC: TrpcHarnessTester<Harness, Provided>;
};

export interface TrpcHarnessTestRuntimeOptions<
	Options,
	Caller extends object,
	Harness,
	Provided,
	LayerError,
> {
	readonly adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">;
	readonly around?: <A, E>(
		effect: Effect.Effect<A, E, Provided>,
	) => Effect.Effect<A, unknown, Provided>;
	readonly createCaller: (options?: Options) => Caller;
	readonly layer: Layer.Layer<Provided, LayerError>;
	readonly makeHarness: (
		trpc: EffectCallerFactory<Options, Caller>,
		context: TestContext,
	) => Effect.Effect<Harness, unknown, Provided>;
}

export type TrpcTestRuntimeOptions<
	Options,
	Caller extends object,
	Provided,
	LayerError,
> = Omit<
	TrpcHarnessTestRuntimeOptions<
		Options,
		Caller,
		EffectCallerFactory<Options, Caller>,
		Provided,
		LayerError
	>,
	"makeHarness"
>;

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

export interface MakeTrpcHarnessItOptions<
	CreateCaller extends (...arguments_: never[]) => object,
	// biome-ignore lint/suspicious/noExplicitAny: Layer output and error are recovered with Layer utility types
	TestLayer extends Layer.Layer<any, any, never>,
	Harness,
> extends MakeTrpcItOptions<CreateCaller, TestLayer> {
	readonly makeHarness: (
		trpc: EffectCallerFactory<
			CallerOptions<CreateCaller>,
			CallerResult<CreateCaller>
		>,
		context: TestContext,
	) => Effect.Effect<Harness, unknown, Layer.Success<TestLayer>>;
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
