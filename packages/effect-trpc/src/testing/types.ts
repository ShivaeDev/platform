import type { TestContext, Vitest } from "@effect/vitest";
import type { EffectClock, EffectTestOptions } from "@shivaedev/effect-test";
import type { Effect, Layer } from "effect";
import type { EffectTRPCAdapter } from "../adapter.ts";
import type { AnyTestLayer } from "./any-test-layer.ts";
import type { EffectCallerFactory } from "./caller.ts";

export type TrpcHarnessTest<Harness, Provided> = <A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
	name: string,
	body: (harness: Harness, context: TestContext) => Generator<Eff, A, never>,
	options?: number | EffectTestOptions,
) => void;

export interface TrpcHarnessTester<Harness, Provided> extends TrpcHarnessTest<Harness, Provided> {
	readonly skip: TrpcHarnessTest<Harness, Provided>;
	readonly skipIf: (condition: unknown) => TrpcHarnessTest<Harness, Provided>;
	readonly runIf: (condition: unknown) => TrpcHarnessTest<Harness, Provided>;
	readonly only: TrpcHarnessTest<Harness, Provided>;
	readonly each: <Item>(
		cases: ReadonlyArray<Item>,
	) => <A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
		name: string,
		body: (item: Item, harness: Harness, context: TestContext) => Generator<Eff, A, never>,
		options?: number | EffectTestOptions,
	) => void;
	readonly fails: TrpcHarnessTest<Harness, Provided>;
}

export type TrpcTest<Options, Caller, Provided> = TrpcHarnessTest<EffectCallerFactory<Options, Caller>, Provided>;

export type TrpcTester<Options, Caller, Provided> = TrpcHarnessTester<EffectCallerFactory<Options, Caller>, Provided>;

export type TrpcIt<Options, Caller, Provided> = Vitest.Methods & {
	readonly effectTRPC: TrpcTester<Options, Caller, Provided>;
};

export type TrpcHarnessIt<Harness, Provided> = Vitest.Methods & {
	readonly effectTRPC: TrpcHarnessTester<Harness, Provided>;
};

export interface MakeTrpcItOptions<CreateCaller extends (...arguments_: never[]) => object, TestLayer extends AnyTestLayer> {
	readonly adapter: Pick<EffectTRPCAdapter<never>, "runWithServices">;
	readonly around?: <A, E>(effect: Effect.Effect<A, E, Layer.Success<TestLayer>>) => Effect.Effect<A, unknown, Layer.Success<TestLayer>>;
	readonly clock?: EffectClock;
	readonly createCaller: CreateCaller;
	readonly layer: TestLayer;
}

export interface MakeTrpcHarnessItOptions<CreateCaller extends (...arguments_: never[]) => object, TestLayer extends AnyTestLayer, Harness>
	extends MakeTrpcItOptions<CreateCaller, TestLayer> {
	readonly makeHarness: (
		trpc: EffectCallerFactory<CallerOptions<CreateCaller>, CallerResult<CreateCaller>>,
		context: TestContext,
	) => Effect.Effect<Harness, unknown, Layer.Success<TestLayer>>;
}

export type CallerOptions<CreateCaller> = CreateCaller extends (...arguments_: infer Arguments) => object ? Arguments[0] : never;

export type CallerResult<CreateCaller> = CreateCaller extends (...arguments_: infer _Arguments) => infer Caller
	? Caller extends object
		? Caller
		: never
	: never;
