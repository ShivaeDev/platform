import type { Effect } from "effect";
import type * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import type * as Reactivity from "effect/unstable/reactivity/Reactivity";
import type { RpcClient, RpcGroup } from "effect/unstable/rpc";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import type { Bound } from "#index.ts";
import type { Notes } from "./notes.ts";

type Rpcs = RpcGroup.Rpcs<typeof Notes>;
type Self = "test/Self";
type Api = Bound<"notes", typeof Notes.declaration.queries, typeof Notes.declaration.commands, Rpcs, Self>;

declare const client: AtomRpc.AtomRpcClient<Self, "test/Client", Rpcs>;
declare const flat: RpcClient.RpcClient.Flat<Rpcs, RpcClientError>;
declare const api: Api;

type Used<Tag extends Rpcs["_tag"]> = ReturnType<
	typeof client.use<Effect.Success<Called<Tag>>, Effect.Error<Called<Tag>>, Effect.Services<Called<Tag>>>
>;
type Called<Tag extends Rpcs["_tag"]> = ReturnType<typeof flat<Tag>>;

expectTypeOf(api.get.query).returns.toEqualTypeOf<ReturnType<typeof client.query<"notes.get">>>();
expectTypeOf(api.list.query).returns.toEqualTypeOf<ReturnType<typeof client.query<"notes.list">>>();
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
