import { it as effectIt, type Vitest } from "@effect/vitest";
import { makeEffectIt } from "@shivaedev/effect-test";
import { Effect, type Layer } from "effect";
import { makeEffectCallerFactory } from "./caller.js";
import type {
	CallerOptions,
	CallerResult,
	MakeTrpcHarnessItOptions,
	MakeTrpcItOptions,
	TrpcHarnessIt,
	TrpcIt,
} from "./types.js";

const withEffectTRPC = <Tester>(
	tester: Tester,
): Vitest.Methods & {
	readonly effectTRPC: Tester;
} =>
	new Proxy(effectIt, {
		get(target, property, receiver) {
			if (property === "effectTRPC") {
				return tester;
			}
			return Reflect.get(target, property, receiver);
		},
	}) as Vitest.Methods & { readonly effectTRPC: Tester };

export const makeTrpcHarnessIt = <
	CreateCaller extends (...arguments_: never[]) => object,
	// biome-ignore lint/suspicious/noExplicitAny: Layer output and error are recovered with Layer utility types
	TestLayer extends Layer.Layer<any, any, never>,
	Harness,
>(
	options: MakeTrpcHarnessItOptions<CreateCaller, TestLayer, Harness>,
): TrpcHarnessIt<Harness, Layer.Success<TestLayer>> => {
	type Options = CallerOptions<CreateCaller>;
	type Caller = CallerResult<CreateCaller>;
	type Provided = Layer.Success<TestLayer>;

	const { effectApp } = makeEffectIt({
		around: options.around,
		clock: options.clock,
		layer: options.layer,
		makeHarness: (context) =>
			Effect.gen(function* () {
				const services = yield* Effect.context<Provided>();
				const trpc = makeEffectCallerFactory(
					options.adapter,
					// CreateCaller is a rest-never function type. The option and
					// result aliases are the factory TypeScript cannot recover here.
					options.createCaller as unknown as (options?: Options) => Caller,
					services,
				);
				return yield* options.makeHarness(trpc, context);
			}),
	});

	return withEffectTRPC(effectApp);
};

export const makeTrpcIt = <
	CreateCaller extends (...arguments_: never[]) => object,
	// biome-ignore lint/suspicious/noExplicitAny: Layer output and error are recovered with Layer utility types
	TestLayer extends Layer.Layer<any, any, never>,
>(
	options: MakeTrpcItOptions<CreateCaller, TestLayer>,
): TrpcIt<
	CallerOptions<CreateCaller>,
	CallerResult<CreateCaller>,
	Layer.Success<TestLayer>
> =>
	makeTrpcHarnessIt({
		...options,
		makeHarness: (trpc) => Effect.succeed(trpc),
	}) as TrpcIt<
		CallerOptions<CreateCaller>,
		CallerResult<CreateCaller>,
		Layer.Success<TestLayer>
	>;
