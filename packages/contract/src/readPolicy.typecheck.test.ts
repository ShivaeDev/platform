import { Context, Effect, type Layer, Option, Schema, type Stream } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import { contract } from "#contract.ts";
import type { makeLiveServer } from "#makeLiveServer.ts";
import { query } from "#operation.ts";
import { querySubscription } from "#querySubscription.ts";
import { authorizeReads, type QueryReadPolicy } from "#readPolicy.ts";
import type { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";

class Database extends Context.Service<Database, boolean>()("test/PolicyDatabase") {}
class ServiceUnavailable extends Schema.TaggedError<ServiceUnavailable>()("ServiceUnavailable", {}) {}
const policy: QueryReadPolicy<void, ServiceUnavailable, Database> = () =>
	Effect.flatMap(Database, (available) => (available ? Effect.succeed(true) : Effect.fail(new ServiceUnavailable())));
const Read = query("read", { readPolicy: policy, reads: () => [], rejections: { ServiceUnavailable } });
const Reads = contract("reads", { queries: [Read] });
const handlers = Reads.application.toLayer({ "reads.read": () => Effect.void });
expectTypeOf<Layer.Services<typeof handlers>>().toEqualTypeOf<Database>();
expectTypeOf<Effect.Error<ReturnType<typeof policy>>>().toEqualTypeOf<ServiceUnavailable>();
// @ts-expect-error Policy services must be installed even when the handler needs none.
const unprovided: Layer.Layer<Layer.Success<typeof handlers>> = handlers;
void unprovided;
// @ts-expect-error A policy can only fail with errors declared in the query's rejections.
query("undeclared", { readPolicy: policy, reads: () => [] });

type ReadRpc = Extract<RpcGroup.Rpcs<typeof Reads>, { readonly _tag: "reads.read" }>;
type ChangesRpc = Extract<RpcGroup.Rpcs<typeof Reads>, { readonly _tag: "reads.$changes" }>;
expectTypeOf<Rpc.ErrorExit<ReadRpc>>().toEqualTypeOf<ServiceUnavailable | QueryReadDenied>();
expectTypeOf<Rpc.ExtractRequires<ChangesRpc, "reads.$changes">>().toEqualTypeOf<Database>();
declare const rpc: ReadRpc;
const authorized = authorizeReads(Effect.void, { payload: undefined, rpc }, Option.none());
expectTypeOf<Effect.Services<typeof authorized>>().toEqualTypeOf<Database>();

const Pushed = contract("pushed", {
	queries: [query("read", { live: "rerun-and-compare", readPolicy: policy, reads: () => [], rejections: { ServiceUnavailable } })],
});
type PushedChanges = Extract<RpcGroup.Rpcs<typeof Pushed>, { readonly _tag: "pushed.$changes" }>;
declare const pushedRpc: PushedChanges;
declare const live: Effect.Success<typeof makeLiveServer>;
const pending = querySubscription(pushedRpc, [{ payload: undefined, query: "read" }], Option.none());
declare const subscription: Effect.Success<typeof pending>;
const pushed = live.subscribe(subscription, undefined, () => Effect.asVoid(Database));
expectTypeOf<Stream.Services<typeof pushed>>().toEqualTypeOf<Database>();
expectTypeOf<Stream.Error<typeof pushed>>().toEqualTypeOf<ServiceUnavailable | QueryReadDenied | MissingReadPolicy>();
expectTypeOf<Rpc.ExtractRequires<PushedChanges, "pushed.$changes">>().toEqualTypeOf<Database>();
