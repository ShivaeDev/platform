import { it as effectIt, type Vitest } from "@effect/vitest";
import { makeEffectIt } from "@shivaedev/effect-test";
import { Effect, type Layer } from "effect";
import type { AnyTestLayer } from "./any-test-layer.ts";
import { makeEffectCallerFactory } from "./caller.ts";
import type { CallerOptions, CallerResult, MakeTrpcHarnessItOptions, MakeTrpcItOptions, TrpcHarnessIt, TrpcIt } from "./types.ts";

function withEffectTRPC<Tester>(tester: Tester): Vitest.Methods & { readonly effectTRPC: Tester };
function withEffectTRPC(tester: unknown): unknown {
	return new Proxy(effectIt, {
		get(target, property, receiver) {
			if (property === "effectTRPC") {
				return tester;
			}
			return Reflect.get(target, property, receiver);
		},
	});
}

export function makeTrpcHarnessIt<CreateCaller extends (...arguments_: never[]) => object, TestLayer extends AnyTestLayer, Harness>(
	options: MakeTrpcHarnessItOptions<CreateCaller, TestLayer, Harness>,
): TrpcHarnessIt<Harness, Layer.Success<TestLayer>>;
export function makeTrpcHarnessIt<TestLayer extends AnyTestLayer, Harness>(
	options: MakeTrpcHarnessItOptions<(options?: unknown) => object, TestLayer, Harness>,
): unknown {
	const { effectApp } = makeEffectIt({
		around: options.around,
		clock: options.clock,
		layer: options.layer,
		makeHarness: (context) =>
			Effect.gen(function* () {
				const services = yield* Effect.context<Layer.Success<TestLayer>>();
				const trpc = makeEffectCallerFactory(options.adapter, options.createCaller, services);
				return yield* options.makeHarness(trpc, context);
			}),
	});

	return withEffectTRPC(effectApp);
}

export const makeTrpcIt = <CreateCaller extends (...arguments_: never[]) => object, TestLayer extends AnyTestLayer>(
	options: MakeTrpcItOptions<CreateCaller, TestLayer>,
): TrpcIt<CallerOptions<CreateCaller>, CallerResult<CreateCaller>, Layer.Success<TestLayer>> =>
	makeTrpcHarnessIt({
		...options,
		makeHarness: (trpc) => Effect.succeed(trpc),
	});
