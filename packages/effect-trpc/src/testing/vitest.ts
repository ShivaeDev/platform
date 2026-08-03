import { it as effectIt, type Vitest } from "@effect/vitest";
import { Effect, Exit, Layer, Scope } from "effect";
import {
	type FixtureTestApi,
	fixtureName,
	makeTrpcHarnessTester,
	makeTrpcTester,
} from "../internal/vitest-trpc.js";
import type {
	CallerOptions,
	CallerResult,
	MakeTrpcHarnessItOptions,
	MakeTrpcItOptions,
	TrpcHarnessIt,
	TrpcIt,
} from "./types.js";

const makeFixtureIt = <Provided, LayerError>(
	layer: Layer.Layer<Provided, LayerError>,
): FixtureTestApi<Provided> =>
	effectIt.extend(
		fixtureName,
		{ scope: "worker" },
		// biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require a destructured context parameter.
		async ({}, { onCleanup }) => {
			const scope = Effect.runSync(Scope.make());
			onCleanup(() => Effect.runPromise(Scope.close(scope, Exit.void)));

			try {
				return await Effect.runPromise(Layer.buildWithScope(layer, scope));
			} catch (error) {
				await Effect.runPromise(Scope.close(scope, Exit.void));
				throw error;
			}
		},
	) as unknown as FixtureTestApi<Provided>;

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
> => {
	type Options = CallerOptions<CreateCaller>;
	type Caller = CallerResult<CreateCaller>;
	type Provided = Layer.Success<TestLayer>;

	const fixtureIt = makeFixtureIt<Provided, Layer.Error<TestLayer>>(
		options.layer,
	);

	const effectTRPC = makeTrpcTester(
		fixtureIt as unknown as FixtureTestApi<Provided>,
		options as unknown as Parameters<
			typeof makeTrpcTester<Options, Caller, Provided, Layer.Error<TestLayer>>
		>[1],
	);

	return withEffectTRPC(effectTRPC) as TrpcIt<Options, Caller, Provided>;
};

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

	const fixtureIt = makeFixtureIt<Provided, Layer.Error<TestLayer>>(
		options.layer,
	);
	const effectTRPC = makeTrpcHarnessTester(
		fixtureIt,
		options as unknown as Parameters<
			typeof makeTrpcHarnessTester<
				Options,
				Caller,
				Harness,
				Provided,
				Layer.Error<TestLayer>
			>
		>[1],
	);

	return withEffectTRPC(effectTRPC);
};
