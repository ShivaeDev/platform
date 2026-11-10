import { Context, Effect, type Layer, Option, Schema, type Stream } from "effect";
import type { Rpc, RpcGroup } from "effect/rpc";
import { expectTypeOf } from "vitest";
import { ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { contract } from "#contract.ts";
import type { LiveServer } from "#live-server/service.ts";
import { subscribe as subscribeQueries } from "#live-server/subscribe.ts";
import type { makeLiveServer } from "#makeLiveServer.ts";
import { query } from "#operation.ts";
import { querySubscription } from "#querySubscription.ts";
import type { QueryUpdate } from "#queryUpdate.ts";
import { authorizeReads, type QueryReadPolicy } from "#readPolicy.ts";
import type { MissingReadPolicies, MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { validateReadPolicies } from "#validateReadPolicies.ts";
import type { WebSocketRequired } from "#WebSocketRequired.ts";

class Database extends Context.Service<Database, boolean>()("@shivaedev/contract/test/PolicyDatabase") {}
const policy: QueryReadPolicy<void, ServiceUnavailable, Database> = () =>
	Effect.flatMap(Database, (available) =>
		available ? Effect.succeed(true) : Effect.fail(new ServiceUnavailable({ message: "Database unavailable" })),
	);
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
expectTypeOf<Rpc.ErrorExit<ReadRpc>>().toEqualTypeOf<ServiceUnavailable | QueryReadDenied | MissingReadPolicy | WebSocketRequired>();
expectTypeOf<Rpc.ExtractRequires<ChangesRpc, "reads.$changes">>().toEqualTypeOf<Database>();
declare const rpc: ReadRpc;
const authorized = authorizeReads(Effect.void, { payload: undefined, rpc }, Option.none());
expectTypeOf<Effect.Services<typeof authorized>>().toEqualTypeOf<Database>();

const Pushed = contract("pushed", {
	queries: [query("read", { readPolicy: policy, reads: () => [], rejections: { ServiceUnavailable } })],
});
type PushedChanges = Extract<RpcGroup.Rpcs<typeof Pushed>, { readonly _tag: "pushed.$changes" }>;
declare const pushedRpc: PushedChanges;
declare const live: Effect.Success<typeof makeLiveServer>;
const pending = querySubscription(pushedRpc, [{ payload: undefined, query: "read" }], Option.none());
declare const subscription: Effect.Success<typeof pending>;
const pushed = live.subscribe(subscription, () => Effect.asVoid(Database));
expectTypeOf<Stream.Services<typeof pushed>>().toEqualTypeOf<Database>();
expectTypeOf<Stream.Error<typeof pushed>>().toEqualTypeOf<ServiceUnavailable | QueryReadDenied | MissingReadPolicy | WebSocketRequired>();

const sharedPushed = subscribeQueries(subscription, () => Effect.asVoid(Database));
const explicitPushed = subscribeQueries<Effect.Error<typeof pending>, Database>(subscription, () => Effect.asVoid(Database));
expectTypeOf(explicitPushed).toEqualTypeOf<typeof sharedPushed>();
expectTypeOf<Stream.Success<Effect.Success<typeof sharedPushed>>>().toEqualTypeOf<QueryUpdate>();
expectTypeOf<Effect.Services<typeof sharedPushed>>().toEqualTypeOf<typeof LiveServer.Identifier>();
expectTypeOf<Stream.Services<Effect.Success<typeof sharedPushed>>>().toEqualTypeOf<Database>();
expectTypeOf<Stream.Error<Effect.Success<typeof sharedPushed>>>().toEqualTypeOf<
	ServiceUnavailable | QueryReadDenied | MissingReadPolicy | WebSocketRequired
>();
expectTypeOf<Rpc.ExtractRequires<PushedChanges, "pushed.$changes">>().toEqualTypeOf<Database>();

const validated = validateReadPolicies(Reads);
expectTypeOf<Effect.Error<typeof validated>>().toEqualTypeOf<MissingReadPolicies>();
// @ts-expect-error Every query declares its read policy, including plain reads.
query("unprotected", { reads: () => [] });

const Derived = query("derived", {
	payload: { scope: Schema.String },
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	rejections: { ServiceUnavailable },
	serverReads: ({ scope }, viewer) => {
		expectTypeOf(scope).toEqualTypeOf<string>();
		expectTypeOf(viewer).toEqualTypeOf<Option.Option<{ readonly id: string }>>();
		return Effect.flatMap(Database, (available) =>
			available ? Effect.succeed([]) : Effect.fail(new ServiceUnavailable({ message: "Database unavailable" })),
		);
	},
});
const DerivedReads = contract("derivedReads", { queries: [Derived] });
const derivedHandlers = DerivedReads.application.toLayer({ "derivedReads.derived": () => Effect.void });
expectTypeOf<Layer.Services<typeof derivedHandlers>>().toEqualTypeOf<Database>();
// @ts-expect-error Server read-key failures must be declared rejections.
query("undeclaredKeys", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	serverReads: () => Effect.fail(new ServiceUnavailable({ message: "Database unavailable" })),
});
