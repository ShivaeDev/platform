import * as NodeRuntime from "@effect/platform-node/NodeRuntime";
import { Context, Data, Effect, Layer, Option, Schema } from "effect";
import { HttpRouter, HttpServerResponse } from "effect/http";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator, SqlClient } from "effect/sql";
import { expectTypeOf, it } from "vitest";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { type AppHttpHostOptions, appHost } from "#appHost.ts";

class Queue extends Context.Service<Queue, { readonly size: number }>()("@shivaedev/server/host-inference/Queue") {}
class QueueError extends Data.TaggedError("QueueError") {}
class QueueEvents extends Context.Service<QueueEvents, (error: Error) => void>()("@shivaedev/server/host-inference/QueueEvents") {}

declare function queueLayer<TErrorRequirements = never>(options: {
	readonly onError?: (error: Error) => Effect.Effect<unknown, never, TErrorRequirements>;
}): Layer.Layer<Queue, QueueError, TErrorRequirements>;

const group = RpcGroup.make(Rpc.make("ping", { success: Schema.String }));
const handlers = group.toLayer({ ping: () => Effect.succeed("pong") });
const services = queueLayer({});
const migrations = { loader: Migrator.fromRecord({}) };
const sessions = Layer.succeed(SessionPolicy, { origin: () => true, provider: { get: () => Effect.succeed(Option.none()) } });
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

const httpOnlyRoutes = HttpRouter.add("GET", "/existing", Queue.pipe(Effect.map(({ size }) => HttpServerResponse.text(String(size)))));
const httpOnlyIncomplete = appHost({ routes: httpOnlyRoutes });
const httpOnlyComplete = appHost({ routes: httpOnlyRoutes, services });
const httpOnlyTyped: AppHttpHostOptions = {};
const httpOnlyTypedHost = appHost(httpOnlyTyped);
const databaseRoute = HttpRouter.add("GET", "/database", SqlClient.SqlClient.use((sql) => sql`select 1`).pipe(Effect.as(HttpServerResponse.empty())));
const httpOnlyMigrated = appHost({ migrations, routes: databaseRoute });
const httpOnlyDeferred = appHost({ application: Effect.succeed({ routes: databaseRoute }), migrations });

it("HTTP-only hosts retain dependencies, build failures and migrated SQL", () => {
	expectTypeOf<Layer.Services<typeof httpOnlyIncomplete>>().toEqualTypeOf<Queue>();
	expectTypeOf<Layer.Services<typeof httpOnlyComplete>>().toEqualTypeOf<never>();
	expectTypeOf<Extract<Layer.Error<typeof httpOnlyComplete>, QueueError>>().toEqualTypeOf<QueueError>();
	expectTypeOf<Layer.Services<typeof httpOnlyTypedHost>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof httpOnlyMigrated>>().toEqualTypeOf<never>();
	expectTypeOf<Layer.Services<typeof httpOnlyDeferred>>().toEqualTypeOf<never>();
});

it("native RPC still requires its group, handlers and session policy together", () => {
	// @ts-expect-error Native RPC requires handlers.
	appHost({ group, policy: "loopback" });
	// @ts-expect-error Native handlers require a group.
	appHost({ handlers, policy: "loopback" });
	// @ts-expect-error Native RPC requires sessions or the explicit loopback policy.
	appHost({ group, handlers });
});
