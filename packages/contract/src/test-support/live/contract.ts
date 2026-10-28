import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "#contract.ts";
import { LiveHint } from "#live.ts";
import { query, stream } from "#operation.ts";

export const documents = collection("documents", Schema.String);
export class Document extends Schema.Class<Document>("Document")({ body: Schema.String, id: Schema.String }) {}
export class Missing extends Schema.TaggedError<Missing>()("Missing", { id: Schema.String }) {}
export class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
export const Get = query("get", {
	payload: { id: Schema.String },
	readPolicy: () => Effect.succeed(true),
	reads: ({ id }) => [documents.item(id)],
	rejections: { Missing, Unavailable },
	success: Document,
});
export const List = query("list", { readPolicy: () => Effect.succeed(true), reads: () => [documents.list], success: Schema.Array(Document) });
export const Subscribe = stream("subscribe", { reads: () => [documents.list], rejections: { Unavailable }, success: LiveHint });
export const Documents = contract("documents", { queries: [Get, List], streams: [Subscribe] });
