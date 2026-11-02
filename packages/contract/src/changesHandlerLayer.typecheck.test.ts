import { Context, Effect, Layer, Option, Schema, Stream } from "effect";
import { type Rpc, RpcGroup, RpcMiddleware } from "effect/rpc";
import { expectTypeOf } from "vitest";
import { changesHandlerLayer } from "#changesHandlerLayer.ts";
import { contract } from "#contract.ts";
import type { makeLiveServer } from "#makeLiveServer.ts";
import { query } from "#operation.ts";
import { querySubscription } from "#querySubscription.ts";
import type { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import type { WebSocketRequired } from "#WebSocketRequired.ts";

class Database extends Context.Service<Database, boolean>()("test/ChangesDatabase") {}
class Reader extends Context.Service<Reader, bigint>()("test/ChangesReader") {}
class Startup extends Context.Service<Startup, string>()("test/ChangesStartup") {}
class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
class Other extends Schema.TaggedError<Other>()("Other", {}) {}
class Guard extends RpcMiddleware.Service<Guard, { provides: Reader }>()("test/ChangesGuard") {}
const Api = contract("custom", {
	queries: [
		query("read", {
			live: "rerun-and-compare",
			payload: { id: Schema.Number },
			readPolicy: () => Effect.flatMap(Database, (ready) => (ready ? Effect.succeed(true) : Effect.fail(new Unavailable()))),
			reads: () => [],
			rejections: { Unavailable },
			success: Schema.BigIntFromString,
		}),
	],
});
declare const live: Effect.Success<typeof makeLiveServer>;
const handlers = changesHandlerLayer(Api, (rpc) => {
	const pending = querySubscription(rpc, [], Option.none());
	expectTypeOf<Effect.Services<typeof pending>>().toEqualTypeOf<Database>();
	expectTypeOf<Effect.Error<typeof pending>>().toEqualTypeOf<Unavailable | MissingReadPolicy | QueryReadDenied | WebSocketRequired>();
	return ({ queries }) => {
		expectTypeOf(queries).toEqualTypeOf<readonly { readonly query: "read"; readonly payload: { readonly id: number } }[]>();
		return Stream.unwrap(
			Effect.gen(function* () {
				const subscription = yield* querySubscription(rpc, queries, Option.none());
				const value = yield* Reader;
				return live.subscribe(subscription, undefined, () => Effect.succeed(value));
			}),
		);
	};
});
expectTypeOf<Layer.Success<typeof handlers>>().toEqualTypeOf<Rpc.Handler<"custom.$changes">>();
expectTypeOf<Layer.Services<typeof handlers>>().toEqualTypeOf<Database | Reader>();
// @ts-expect-error A custom subscription cannot run without its read-policy and rerun services.
const missing: Layer.Layer<Layer.Success<typeof handlers>> = handlers;
void missing;
const complete = handlers.pipe(Layer.provide(Layer.merge(Layer.succeed(Database, true), Layer.succeed(Reader, 1n))));
expectTypeOf<Layer.Services<typeof complete>>().toEqualTypeOf<never>();
const policyOnly = changesHandlerLayer(Api, () => () => Stream.never);
expectTypeOf<Layer.Services<typeof policyOnly>>().toEqualTypeOf<Database>();

const initialized = changesHandlerLayer(Api, () =>
	Effect.gen(function* () {
		yield* Startup;
		yield* new Unavailable();
		return () => Stream.fromEffect(Reader).pipe(Stream.as({ _tag: "Resync" }));
	}),
);
expectTypeOf<Layer.Error<typeof initialized>>().toEqualTypeOf<Unavailable>();
expectTypeOf<Layer.Services<typeof initialized>>().toEqualTypeOf<Database | Reader | Startup>();
const guarded = changesHandlerLayer(Api.middleware(Guard), () => () => Stream.fromEffect(Reader).pipe(Stream.as({ _tag: "Resync" })));
expectTypeOf<Layer.Services<typeof guarded>>().toEqualTypeOf<Database>();
// @ts-expect-error A custom stream can fail only with the contract's declared failures.
changesHandlerLayer(Api, () => () => Stream.fail(new Other()));
const merged = changesHandlerLayer(Api.merge(contract("another", {})), () => () => Stream.never);
expectTypeOf<Layer.Success<typeof merged>>().toEqualTypeOf<Rpc.Handler<"custom.$changes"> | Rpc.Handler<"another.$changes">>();
const empty = changesHandlerLayer(RpcGroup.make(), () => () => Stream.never);
expectTypeOf<Layer.Success<typeof empty>>().toEqualTypeOf<never>();

const Plain = contract("plain", {
	queries: [query("read", { readPolicy: () => Effect.succeed(true), reads: () => [] })],
});
const partialMiddleware = changesHandlerLayer(
	Api.middleware(Guard).merge(Plain),
	() => () => Stream.fromEffect(Reader).pipe(Stream.as({ _tag: "Resync" })),
);
expectTypeOf<Layer.Services<typeof partialMiddleware>>().toEqualTypeOf<Database | Reader>();
