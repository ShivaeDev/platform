import { Effect, Schema, Stream } from "effect";
import type { Rpc, RpcClient, RpcGroup } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import { contract } from "#contract.ts";
import type { Key } from "#keys.ts";
import type { LiveHint } from "#live.ts";
import { command, query, stream } from "#operation.ts";
import { type Denied, type Guard, Notes, notes } from "#test/notes.ts";

type Rpcs = RpcGroup.Rpcs<typeof Notes>;
type Changes = Rpc.ExtractTag<Rpcs, "notes.$changes">;
declare const client: RpcClient.RpcClient.Flat<Rpcs, RpcClientError>;

const changes = client("notes.$changes", { keys: [notes.item(1)] });
expectTypeOf(changes).toEqualTypeOf<Stream.Stream<LiveHint, Denied | RpcClientError>>();
expectTypeOf<Rpc.Payload<Changes>>().toEqualTypeOf<{ readonly keys: readonly Key[] }>();
expectTypeOf<Rpc.Middleware<Changes>>().toEqualTypeOf<Guard>();

const Empty = contract("empty", {});
type EmptyChanges = RpcGroup.Rpcs<typeof Empty>;
expectTypeOf<EmptyChanges["_tag"]>().toEqualTypeOf<"empty.$changes">();
expectTypeOf<Rpc.Middleware<EmptyChanges>>().toEqualTypeOf<never>();

expectTypeOf<RpcGroup.Rpcs<typeof Notes.application>>().toEqualTypeOf<Exclude<Rpcs, Changes>>();
expectTypeOf<Rpc.Middleware<RpcGroup.Rpcs<typeof Notes.application>>>().toEqualTypeOf<Guard>();
expectTypeOf<RpcGroup.Rpcs<typeof Empty.application>>().toEqualTypeOf<never>();
const Explicit = Notes.omit("notes.$changes");
expectTypeOf(Notes.application).toEqualTypeOf<typeof Explicit>();

const Mixed = contract("mixed", {
	commands: [command("write", { invalidates: () => [] })],
	queries: [query("read", { reads: () => [], success: Schema.Number })],
	streams: [stream("follow", { reads: () => [], success: Schema.String })],
});
const handlers = Mixed.application.of({
	"mixed.follow": () => Stream.empty,
	"mixed.read": () => Effect.succeed(1),
	"mixed.write": () => Effect.void,
});
Mixed.application.toLayer(Effect.succeed(handlers));
expectTypeOf<RpcGroup.Rpcs<typeof Mixed.application>["_tag"]>().toEqualTypeOf<"mixed.read" | "mixed.write" | "mixed.follow">();
// @ts-expect-error The full contract still requires its changes stream handler.
Mixed.toLayer(handlers);
