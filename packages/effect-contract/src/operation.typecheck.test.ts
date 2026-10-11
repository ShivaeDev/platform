import { type Effect, Layer, Schema, Stream } from "effect";
import { FetchHttpClient } from "effect/unstable/http";
import * as AtomRpc from "effect/unstable/reactivity/AtomRpc";
import { Rpc, RpcClient, RpcGroup, type RpcSchema, RpcSerialization } from "effect/unstable/rpc";
import type { RpcClientError } from "effect/unstable/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import { bind } from "#bind.ts";
import { contract } from "#contract.ts";
import { collection } from "#keys.ts";
import { command, query, stream } from "#operation.ts";
import { Denied, Guard, NoteMissing } from "#test/notes.ts";

const notes = collection("notes", Schema.Number);
const Subscribe = stream("subscribe", {
	payload: { id: Schema.Number },
	reads: ({ id }) => [notes.item(id)],
	rejections: { NoteMissing },
	success: Schema.String,
});
const Notes = contract("notes", { streams: [Subscribe] }).middleware(Guard);
class Client extends AtomRpc.Service<Client>()("test/Streaming", {
	group: Notes,
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/rpc" }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
}) {}
const api = bind(Notes, Client);
expectTypeOf(api.subscribe.run).parameter(0).toEqualTypeOf<{ readonly id: number }>();
expectTypeOf(api.subscribe.run).returns.toEqualTypeOf<Stream.Stream<string, NoteMissing | Denied | RpcClientError, Client>>();
expectTypeOf(Subscribe.reject.NoteMissing({ id: 1 })).toEqualTypeOf<Effect.Effect<never, NoteMissing>>();
expectTypeOf(Subscribe.reads).parameter(0).toEqualTypeOf<{ readonly id: number }>();
expectTypeOf(Notes.requests.get("notes.subscribe")?.successSchema).toEqualTypeOf<
	RpcSchema.Stream<Schema.String, typeof Subscribe.error> | undefined
>();

// @ts-expect-error A stream has no query atom member.
api.subscribe.query();
// @ts-expect-error Streams participate in the same operation namespace as queries.
contract("duplicate", { queries: [query("subscribe", { reads: () => [] })], streams: [Subscribe] });
// @ts-expect-error Streams participate in the same operation namespace as commands.
contract("duplicate", { commands: [command("subscribe", { invalidates: () => [] })], streams: [Subscribe] });
// @ts-expect-error Literal stream names must be unique.
contract("duplicate", { streams: [Subscribe, Subscribe] });
// @ts-expect-error The element schema is required.
stream("missing", { reads: () => [] });
// @ts-expect-error A stream handler cannot return an undeclared rejection.
Notes.of({ "notes.subscribe": () => Stream.fail(new Denied()) });

const Unary = RpcGroup.make(
	Rpc.make("notes.subscribe", { error: Subscribe.error, payload: Subscribe.payload, success: Subscribe.success }),
).middleware(Guard);
class UnaryClient extends AtomRpc.Service<UnaryClient>()("test/Unary", {
	group: Unary,
	protocol: RpcClient.layerProtocolHttp({ url: "http://127.0.0.1/rpc" }).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson])),
}) {}
// @ts-expect-error A unary client cannot implement a streaming operation.
bind(Notes, UnaryClient);
