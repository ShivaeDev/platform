import type { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { RpcClient, RpcGroup } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import type { Bound } from "#Bound.ts";
import type { MissingReadPolicy } from "#readPolicyErrors.ts";
import type { NoteMissing, Notes } from "#test/notes.ts";
import type { WebSocketRequired } from "#WebSocketRequired.ts";

type Rpcs = RpcGroup.Rpcs<typeof Notes>;
type Self = "test/Self";
type Api = Bound<"notes", typeof Notes.declaration.queries, typeof Notes.declaration.commands, Rpcs, Self>;

declare const client: AtomRpc.AtomRpcClient<Self, "test/Client", Rpcs>;
declare const flat: RpcClient.RpcClient.Flat<Rpcs, RpcClientError>;
declare const api: Api;

type Used<TTag extends Rpcs["_tag"]> = ReturnType<
	typeof client.use<Effect.Success<Called<TTag>>, Effect.Error<Called<TTag>>, Effect.Services<Called<TTag>>>
>;
type Called<TTag extends Rpcs["_tag"]> = ReturnType<typeof flat<TTag>>;

type WithSubscription<T extends Atom.Atom<AsyncResult.AsyncResult<unknown, unknown>>> = Atom.Atom<
	AsyncResult.AsyncResult<Atom.Success<T>, Atom.Failure<T> | NoteMissing | MissingReadPolicy | WebSocketRequired>
>;
expectTypeOf(api.get.query).returns.toEqualTypeOf<WithSubscription<ReturnType<typeof client.query<"notes.get">>>>();
expectTypeOf(api.list.query).returns.toEqualTypeOf<WithSubscription<ReturnType<typeof client.query<"notes.list">>>>();
expectTypeOf(api.get.run).returns.toEqualTypeOf<Used<"notes.get">>();
expectTypeOf(api.rename.run).returns.toEqualTypeOf<
	Effect.Effect<
		Effect.Success<Used<"notes.rename">>,
		Effect.Error<Used<"notes.rename">>,
		Effect.Services<Used<"notes.rename">> | Reactivity.Reactivity
	>
>();
expectTypeOf(api.get.query).parameter(0).toEqualTypeOf<Parameters<typeof client.query<"notes.get">>[1]>();
expectTypeOf(api.rename.run).parameter(0).toEqualTypeOf<Parameters<typeof flat<"notes.rename">>[1]>();
