import { NodeRuntime } from "@effect/platform-node";
import { Context, Data, Effect, Layer, Option, Schema } from "effect";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import { appHost } from "#appHost.ts";

class Queue extends Context.Service<Queue, { readonly size: number }>()("host-inference/Queue") {}
class QueueError extends Data.TaggedError("QueueError") {}
class QueueEvents extends Context.Service<QueueEvents, (error: Error) => void>()("host-inference/QueueEvents") {}

declare function queueLayer<TErrorRequirements = never>(options: {
	readonly onError?: (error: Error) => Effect.Effect<unknown, never, TErrorRequirements>;
}): Layer.Layer<Queue, QueueError, TErrorRequirements>;

const group = RpcGroup.make(Rpc.make("ping", { success: Schema.String }));
const handlers = group.toLayer({ ping: () => Effect.succeed("pong") });
const services = queueLayer({});
const migrations = { loader: Migrator.fromRecord({}) };
const sessions = { origin: () => true, provider: { get: () => Effect.succeed(Option.none()) } };
const topLevel = appHost({ group, handlers, policy: "loopback", services: queueLayer({}) });
const constBound = Layer.unwrap(Effect.succeed(appHost({ group, handlers, policy: "loopback", services })));
const inlineUnderUnwrap = Layer.unwrap(Effect.succeed(appHost({ group, handlers, policy: "loopback", services: queueLayer({}) })));

const launchTopLevel: Effect.Effect<never, unknown, never> = Layer.launch(topLevel);
const launchConstBound: Effect.Effect<never, unknown, never> = Layer.launch(constBound);
const launchInlineUnderUnwrap: Effect.Effect<never, unknown, never> = Layer.launch(inlineUnderUnwrap);

const inlineGenerator = Layer.unwrap(
	Effect.gen(function* () {
		const port = yield* Effect.succeed(0);
		yield* Effect.void;
		return appHost({ config: { port }, group, handlers, policy: "loopback", services: queueLayer({}) });
	}),
);
const makeHost = Effect.gen(function* () {
	const port = yield* Effect.succeed(0);
	yield* Effect.void;
	return appHost({ config: { port }, group, handlers, policy: "loopback", services: queueLayer({}) });
});
const constBoundGenerator = Layer.unwrap(makeHost);
const withoutServices = Layer.unwrap(
	Effect.gen(function* () {
		const port = yield* Effect.succeed(0);
		yield* Effect.void;
		return appHost({ config: { port }, group, handlers, policy: "loopback" });
	}),
);
const migratedGenerator = Layer.unwrap(
	Effect.gen(function* () {
		const port = yield* Effect.succeed(0);
		yield* Effect.void;
		return appHost({ config: { port }, group, handlers, migrations, services: queueLayer({}), sessions });
	}),
);
const migratedLoopback = Layer.unwrap(Effect.succeed(appHost({ group, handlers, migrations, policy: "loopback", services: queueLayer({}) })));
const httpWithSessions = Layer.unwrap(Effect.succeed(appHost({ group, handlers, services: queueLayer({}), sessions })));
const withRequirements = Layer.unwrap(
	Effect.gen(function* () {
		yield* Effect.void;
		return appHost({ group, handlers, policy: "loopback", services: queueLayer({ onError: () => QueueEvents }) });
	}),
);

it("infers launchable hosts with inline generic service factories", () => {
	expectTypeOf<Layer.Services<typeof topLevel>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof constBound>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof inlineUnderUnwrap>>().toEqualTypeOf<never>();
	expectTypeOf(launchTopLevel).toEqualTypeOf<Effect.Effect<never, unknown, never>>();
	expectTypeOf(launchConstBound).toEqualTypeOf<Effect.Effect<never, unknown, never>>();
	expectTypeOf(launchInlineUnderUnwrap).toEqualTypeOf<Effect.Effect<never, unknown, never>>();
	expectTypeOf(() => NodeRuntime.runMain(Layer.launch(inlineUnderUnwrap))).toBeFunction();
});

it("infers launchable hosts returned after generator yields", () => {
	expectTypeOf<Layer.Services<typeof inlineGenerator>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof constBoundGenerator>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof withoutServices>>().toEqualTypeOf<never>();
	expectTypeOf(() => NodeRuntime.runMain(Layer.launch(inlineGenerator))).toBeFunction();
	expectTypeOf(() => NodeRuntime.runMain(Layer.launch(constBoundGenerator))).toBeFunction();
	expectTypeOf(() => NodeRuntime.runMain(Layer.launch(withoutServices))).toBeFunction();
});

it("infers service factories through migrated and session host options", () => {
	expectTypeOf<Layer.Services<typeof migratedGenerator>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof migratedLoopback>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof httpWithSessions>>().toEqualTypeOf<never>();
	expectTypeOf(() => NodeRuntime.runMain(Layer.launch(migratedGenerator))).toBeFunction();
});

it("preserves service outputs, failures and callback requirements", () => {
	expectTypeOf<Extract<Layer.Success<typeof inlineGenerator>, Queue>>().toEqualTypeOf<Queue>();
	expectTypeOf<Extract<Layer.Error<typeof inlineGenerator>, QueueError>>().toEqualTypeOf<QueueError>();
	expectTypeOf<Layer.Services<typeof withRequirements>>().toEqualTypeOf<QueueEvents>();
	// @ts-expect-error The service factory's callback requirement must be provided.
	NodeRuntime.runMain(Layer.launch(withRequirements));
});
