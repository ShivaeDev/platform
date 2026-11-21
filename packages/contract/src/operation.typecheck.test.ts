import { Effect, Schema, Stream } from "effect";
import type { Rpc, RpcGroup, RpcSchema } from "effect/rpc";
import type { RpcClientError } from "effect/rpc/RpcClientError";
import { expectTypeOf } from "vitest";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "#contract.ts";
import { type ContractsClient, makeClient } from "#makeClient.ts";
import { command, query, stream } from "#operation.ts";
import { type Denied, Guard, NoteMissing } from "#test/notes.ts";

const notes = collection("notes", Schema.Number);
// Neither the stream nor its middleware declares this failure.
class Undeclared extends Schema.TaggedError<Undeclared>()("Undeclared", {}) {}
const Subscribe = stream("subscribe", {
	payload: { id: Schema.Number },
	reads: ({ id }) => [notes.item(id)],
	rejections: { NoteMissing },
	success: Schema.String,
});
const Notes = contract("notes", { streams: [Subscribe] }).middleware(Guard);
const api = makeClient({ notes: Notes }, { url: "http://127.0.0.1/rpc" }).api.notes;
expectTypeOf(api.subscribe.run).parameter(0).toEqualTypeOf<{ readonly id: number }>();
expectTypeOf(api.subscribe.run).returns.toEqualTypeOf<Stream.Stream<string, NoteMissing | Denied | RpcClientError, ContractsClient>>();
expectTypeOf(Subscribe.reject.NoteMissing({ id: 1 })).toEqualTypeOf<Effect.Effect<never, NoteMissing>>();
expectTypeOf(Subscribe.reads).parameter(0).toEqualTypeOf<{ readonly id: number }>();
expectTypeOf<Rpc.SuccessSchema<Rpc.ExtractTag<RpcGroup.Rpcs<typeof Notes>, "notes.subscribe">>>().toEqualTypeOf<
	RpcSchema.Stream<Schema.String, typeof Subscribe.error>
>();

// @ts-expect-error A stream has no query atom member.
api.subscribe.query();
// @ts-expect-error Streams participate in the same operation namespace as queries.
contract("duplicate", { queries: [query("subscribe", { readPolicy: () => Effect.succeed(true), reads: () => [] })], streams: [Subscribe] });
// @ts-expect-error Streams participate in the same operation namespace as commands.
contract("duplicate", { commands: [command("subscribe", { invalidates: () => [] })], streams: [Subscribe] });
// @ts-expect-error Literal stream names must be unique.
contract("duplicate", { streams: [Subscribe, Subscribe] });
// @ts-expect-error The element schema is required.
stream("missing", { reads: () => [] });
// @ts-expect-error A stream handler cannot return an undeclared rejection.
Notes.of({ "notes.$changes": () => Stream.never, "notes.subscribe": () => Stream.fail(new Undeclared()) });
