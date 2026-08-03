import { it as effectIt } from "@effect/vitest";
import { Effect, Exit, Layer, Scope } from "effect";
import {
	type FixtureTestApi,
	fixtureName,
	makeTrpcTester,
} from "../internal/vitest-trpc.js";
import type {
	CallerOptions,
	CallerResult,
	MakeTrpcItOptions,
	TrpcIt,
} from "./types.js";

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

	const fixtureIt = effectIt.extend(
		fixtureName,
		{ scope: "worker" },
		// biome-ignore lint/correctness/noEmptyPattern: Vitest fixtures require a destructured context parameter.
		async ({}, { onCleanup }) => {
			const scope = Effect.runSync(Scope.make());
			onCleanup(() => Effect.runPromise(Scope.close(scope, Exit.void)));

			try {
				return await Effect.runPromise(
					Layer.buildWithScope(options.layer, scope),
				);
			} catch (error) {
				await Effect.runPromise(Scope.close(scope, Exit.void));
				throw error;
			}
		},
	);

	const effectTRPC = makeTrpcTester(
		fixtureIt as unknown as FixtureTestApi<Provided>,
		options as unknown as Parameters<
			typeof makeTrpcTester<Options, Caller, Provided, Layer.Error<TestLayer>>
		>[1],
	);

	return new Proxy(effectIt, {
		get(target, property, receiver) {
			if (property === "effectTRPC") {
				return effectTRPC;
			}
			return Reflect.get(target, property, receiver);
		},
	}) as TrpcIt<Options, Caller, Provided>;
};
