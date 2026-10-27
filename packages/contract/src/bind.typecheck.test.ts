import type { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { RpcClient, RpcGroup } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import { type Bound, bind } from "#bind.ts";
import type { MissingReadPolicy } from "#readPolicyErrors.ts";
import type { ResumeSource } from "#resume.ts";
import { Notes } from "#test/notes.ts";
import { Preferences } from "#test/sessionContract.ts";

type WithPolicyFailure<T> =
	T extends Atom.Atom<AsyncResult.AsyncResult<infer A, infer E>> ? Atom.Atom<AsyncResult.AsyncResult<A, E | MissingReadPolicy>> : never;

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

expectTypeOf(api.get.query).returns.toEqualTypeOf<WithPolicyFailure<ReturnType<typeof client.query<"notes.get">>>>();
expectTypeOf(api.list.query).returns.toEqualTypeOf<WithPolicyFailure<ReturnType<typeof client.query<"notes.list">>>>();
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

declare const scopedClient: AtomRpc.AtomRpcClient<Self, "test/ScopedClient", RpcGroup.Rpcs<typeof Preferences>>;
declare const registry: AtomRegistry.AtomRegistry;
declare const resume: ResumeSource;
bind(Notes, client, { resume });
bind(Preferences, scopedClient, { registry });
bind(Preferences, scopedClient, { registry, resume });
// @ts-expect-error Session-scoped bindings require the session's registry.
bind(Preferences, scopedClient);
// @ts-expect-error A resume source does not replace the session's registry.
bind(Preferences, scopedClient, { resume });
