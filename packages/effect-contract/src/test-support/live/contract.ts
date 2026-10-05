import { Schema } from "effect";
import { Rpc } from "effect/unstable/rpc";
import { contract } from "#contract.ts";
import { collection } from "#keys.ts";
import { LiveHint } from "#live.ts";
import { query } from "#operation.ts";

export const documents = collection("documents", Schema.String);
export const workspace = collection("workspace", Schema.String);
export class Document extends Schema.Class<Document>("Document")({ body: Schema.String, id: Schema.String }) {}
export class Missing extends Schema.TaggedError<Missing>()("Missing", { id: Schema.String }) {}
export class Unavailable extends Schema.TaggedError<Unavailable>()("Unavailable", {}) {}
export const Get = query("get", {
	payload: { id: Schema.String },
	reads: ({ id }) => [documents.item(id), workspace.list],
	rejections: { Missing, Unavailable },
	success: Document,
});
export const List = query("list", { reads: () => [documents.list, workspace.list], success: Schema.Array(Document) });
export const Documents = contract("documents", { queries: [Get, List] });
export const Subscribe = Rpc.make("subscribe", { error: Unavailable, stream: true, success: LiveHint });
export const LiveDocuments = Documents.add(Subscribe);
