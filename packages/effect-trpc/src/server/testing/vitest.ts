import { it as effectIt, type Vitest } from "@effect/vitest";
import { Effect, type Layer } from "effect";
import type { AnyTestLayer } from "@shivaedev/effect-test/anyTestLayer.ts";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { makeEffectCallerFactory } from "./caller.ts";
import type { CallerOptions, CallerResult, MakeTrpcHarnessItOptions, MakeTrpcItOptions, TrpcHarnessIt, TrpcIt } from "./types.ts";

function withEffectTrpc<TTester>(tester: TTester): Vitest.Methods & {
	readonly "effectTRPC": TTester;
};
function withEffectTrpc(tester: unknown): unknown {
	return new Proxy(effectIt, {
		get(target, property, receiver) {
			if (property === "effectTRPC") {
				return tester;
			}
			return Reflect.get(target, property, receiver);
		},
	});
}
export function makeTrpcHarnessIt<TCreateCaller extends (...arguments_: never[]) => object, TTestLayer extends AnyTestLayer, THarness>(
	options: MakeTrpcHarnessItOptions<TCreateCaller, TTestLayer, THarness>,
): TrpcHarnessIt<THarness, Layer.Success<TTestLayer>>;
export function makeTrpcHarnessIt<TTestLayer extends AnyTestLayer, THarness>(
	options: MakeTrpcHarnessItOptions<(options?: unknown) => object, TTestLayer, THarness>,
): unknown {
	const { effectApp } = makeEffectIt({
		around: options.around,
		clock: options.clock,
		layer: options.layer,
		makeHarness: (context) =>
			Effect.gen(function* () {
				const services = yield* Effect.context<Layer.Success<TTestLayer>>();
				const trpc = makeEffectCallerFactory(options.adapter, options.createCaller, services);
				return yield* options.makeHarness(trpc, context);
			}),
	});
	return withEffectTrpc(effectApp);
}
export function makeTrpcIt<TCreateCaller extends (...arguments_: never[]) => object, TTestLayer extends AnyTestLayer>(
	options: MakeTrpcItOptions<TCreateCaller, TTestLayer>,
): TrpcIt<CallerOptions<TCreateCaller>, CallerResult<TCreateCaller>, Layer.Success<TTestLayer>> {
	return makeTrpcHarnessIt({
		...options,
		makeHarness: (trpc) => Effect.succeed(trpc),
	});
}
