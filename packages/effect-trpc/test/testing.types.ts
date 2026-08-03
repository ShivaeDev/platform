import { initTRPC } from "@trpc/server";
import { Context, Effect, Layer, ManagedRuntime } from "effect";
import { expectTypeOf } from "vitest";
import { makeEffectTRPC, makeRequestServices } from "../src/index.js";
import { makeTrpcHarnessIt, makeTrpcIt } from "../src/testing.js";

class RuntimeService extends Context.Service<RuntimeService, number>()(
	"@testing-types/RuntimeService",
) {}

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
const it = makeTrpcIt({
	adapter,
	createCaller: (options = { actor: "default" }) =>
		router.createCaller(options),
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
	createCaller: (options = { actor: "default" }) =>
		router.createCaller(options),
	layer: Layer.succeed(RuntimeService, 2),
	makeHarness: (trpc) =>
		Effect.map(RuntimeService, (value) => ({ trpc, value })),
});

harnessIt.effectTRPC("retains custom harness types", function* (harness) {
	expectTypeOf(harness).not.toBeAny();
	expectTypeOf(harness.value).toEqualTypeOf<number>();
	const result = yield* harness.trpc.read();
	expectTypeOf(result).toEqualTypeOf<number>();

	// @ts-expect-error Custom harnesses do not widen unknown properties.
	harness.missing;
});
