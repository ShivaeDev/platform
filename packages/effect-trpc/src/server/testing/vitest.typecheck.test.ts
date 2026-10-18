import { initTRPC } from "@trpc/server";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { expectTypeOf } from "vitest";
import type { AnyTestLayer as EffectTestLayer } from "@shivaedev/effect-test/any-test-layer.ts";
import { makeEffectTRPC } from "#server/adapter.ts";
import { makeRequestServices } from "#server/requestServices.ts";
import type { AnyTestLayer } from "#server/testing/AnyTestLayer.ts";
import { makeTrpcHarnessIt, makeTrpcIt } from "#server/testing/vitest.ts";

class RuntimeService extends Context.Service<RuntimeService, number>()("@testing-types/RuntimeService") {}
interface CallerOptions {
	readonly actor: string;
}
const runtime = ManagedRuntime.make(Layer.succeed(RuntimeService, 1));
const adapter = makeEffectTRPC({ runtime });
const t = initTRPC.context<CallerOptions>().create();
const procedure = adapter.procedure(
	t.procedure,
	makeRequestServices(() => Layer.empty),
);
const router = t.router({
	read: procedure.query(function* () {
		return yield* RuntimeService;
	}),
});
expectTypeOf<AnyTestLayer>().toEqualTypeOf<EffectTestLayer>();
const emptyIt = makeTrpcIt({
	adapter,
	createCaller: () => router.createCaller({ actor: "empty" }),
	layer: Layer.empty,
});
emptyIt.effectTRPC("retains caller types with an empty test Layer", function* (trpc) {
	expectTypeOf(yield* trpc.read()).toEqualTypeOf<number>();
});
const emptyHarnessIt = makeTrpcHarnessIt({
	adapter,
	createCaller: () => router.createCaller({ actor: "empty" }),
	layer: Layer.empty,
	makeHarness: (trpc) => Effect.succeed({ trpc }),
});
emptyHarnessIt.effectTRPC("retains harness types with an empty test Layer", function* (harness) {
	expectTypeOf(yield* harness.trpc.read()).toEqualTypeOf<number>();
});
makeTrpcIt({
	adapter,
	createCaller: () => router.createCaller({ actor: "unmet" }),
	// @ts-expect-error Test Layers must have no unmet requirements.
	layer: Layer.effect(RuntimeService, RuntimeService),
});
makeTrpcHarnessIt({
	adapter,
	createCaller: () => router.createCaller({ actor: "unmet" }),
	// @ts-expect-error Harness test Layers must have no unmet requirements.
	layer: Layer.effect(RuntimeService, RuntimeService),
	makeHarness: (trpc) => Effect.succeed({ trpc }),
});
const it = makeTrpcIt({
	adapter,
	createCaller: (options = { actor: "default" }) => router.createCaller(options),
	layer: Layer.succeed(RuntimeService, 2),
});
it.effectTRPC("retains caller types", function* (trpc) {
	expectTypeOf(trpc).not.toBeAny();
	const result = yield* trpc.read();
	expectTypeOf(result).toEqualTypeOf<number>();
	expectTypeOf(result).not.toBeAny();
	const alternate = yield* trpc({ actor: "alternate" }).read();
	expectTypeOf(alternate).toEqualTypeOf<number>();
	// @ts-expect-error Unknown procedures are rejected by the Effect caller.
	yield* trpc.missing();
	// @ts-expect-error Caller options preserve their application type.
	yield* trpc({ actor: 1 }).read();
});
const harnessIt = makeTrpcHarnessIt({
	adapter,
	createCaller: (options = { actor: "default" }) => router.createCaller(options),
	layer: Layer.succeed(RuntimeService, 2),
	makeHarness: (trpc) => Effect.map(RuntimeService, (value) => ({ trpc, value })),
});
harnessIt.effectTRPC("retains custom harness types", function* (harness) {
	expectTypeOf(harness).not.toBeAny();
	expectTypeOf(harness.value).toEqualTypeOf<number>();
	const result = yield* harness.trpc.read();
	expectTypeOf(result).toEqualTypeOf<number>();
	// @ts-expect-error Custom harnesses do not widen unknown properties.
	void harness.missing;
});
makeTrpcIt({
	adapter,
	around: (effect) =>
		Effect.gen(function* () {
			yield* Effect.addFinalizer(() => Effect.void);
			return yield* effect;
		}),
	createCaller: () => router.createCaller({ actor: "scoped" }),
	layer: Layer.succeed(RuntimeService, 2),
});
