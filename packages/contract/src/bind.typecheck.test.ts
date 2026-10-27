import type { Effect } from "effect";
import { mapRequest } from "effect/http/HttpClient";
import { setHeader, setHeaders } from "effect/http/HttpClientRequest";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type * as AtomRpc from "effect/reactivity/AtomRpc";
import type * as Reactivity from "effect/reactivity/Reactivity";
import type { RpcClient, RpcGroup } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import { type Bound, bind, makeClient } from "#bind.ts";
import type { ResumeSource } from "#resume.ts";
import { type Note, Notes } from "#test/notes.ts";
import { Preferences } from "#test/sessionContract.ts";

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

const httpClient = makeClient(Notes, {
	transformClient: (http) => mapRequest(http, setHeaders({ cookie: "session=test", origin: "https://app.test" })),
	url: "https://app.test/rpc",
});
expectTypeOf(httpClient.api.get.run).parameter(0).toEqualTypeOf<{ readonly id: number }>();
expectTypeOf<Effect.Success<ReturnType<typeof httpClient.api.get.run>>>().toEqualTypeOf<Note>();
httpClient.runtime.atom(httpClient.api.get.run({ id: 1 }));
httpClient.runtime.fn(httpClient.api.rename.run);
makeClient(Notes, {
	transformClient: (http) => mapRequest(http, setHeader("authorization", "Bearer token")),
	url: "https://app.test/rpc",
});
makeClient(Preferences, { registry: AtomRegistry.make(), url: "https://app.test/rpc" });
// @ts-expect-error A session-scoped client needs its registry.
makeClient(Preferences, { url: "https://app.test/rpc" });
// @ts-expect-error Payload types survive client construction.
httpClient.api.get.run({ id: "1" });
