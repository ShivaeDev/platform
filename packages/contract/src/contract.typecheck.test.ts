import { Effect, Schema, Stream } from "effect";
import type { Rpc, RpcClient, RpcGroup } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import { contract } from "#contract.ts";
import type { LiveHint } from "#live.ts";
import { command, query, stream } from "#operation.ts";
import type { MissingReadPolicy, QueryReadDenied } from "#readPolicyErrors.ts";
import { type Denied, type Guard, type NoteMissing, Notes } from "#test/notes.ts";

type Rpcs = RpcGroup.Rpcs<typeof Notes>;
type Changes = Rpc.ExtractTag<Rpcs, "notes.$changes">;
declare const client: RpcClient.RpcClient.Flat<Rpcs, RpcClientError>;

const changes = client("notes.$changes", { queries: [{ payload: { id: 1 }, query: "get" }] });
expectTypeOf(changes).toEqualTypeOf<Stream.Stream<LiveHint, Denied | NoteMissing | MissingReadPolicy | QueryReadDenied | RpcClientError>>();
expectTypeOf<Rpc.Payload<Changes>>().toEqualTypeOf<{
	readonly queries: readonly (
		| { readonly query: "get"; readonly payload: { readonly id: number } }
		| { readonly query: "list"; readonly payload: Schema.Void["Type"] }
	)[];
}>();
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
type MixedRead = Rpc.ExtractTag<RpcGroup.Rpcs<typeof Mixed>, "mixed.read">;
expectTypeOf<Rpc.ErrorExit<MixedRead>>().toEqualTypeOf<QueryReadDenied>();
const handlers = Mixed.application.of({
	"mixed.follow": () => Stream.empty,
	"mixed.read": () => Effect.succeed(1),
	"mixed.write": () => Effect.void,
});
Mixed.application.toLayer(Effect.succeed(handlers));
expectTypeOf<RpcGroup.Rpcs<typeof Mixed.application>["_tag"]>().toEqualTypeOf<"mixed.read" | "mixed.write" | "mixed.follow">();
// @ts-expect-error The full contract still requires its changes stream handler.
Mixed.toLayer(handlers);

// @ts-expect-error Subscriptions only name declared queries.
client("notes.$changes", { queries: [{ payload: { id: 1, title: "Changed" }, query: "rename" }] });
// @ts-expect-error Query payload schemas also type subscription references.
client("notes.$changes", { queries: [{ payload: { id: "one" }, query: "get" }] });
// @ts-expect-error Raw keys are not a subscription payload.
client("notes.$changes", { keys: [] });
