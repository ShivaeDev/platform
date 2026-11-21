import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";

const shelf = collection("record-shelf", Schema.Number);

export const Shelf = contract("shelf", {
	commands: [command("shelve", { invalidates: () => [shelf.item(1)], payload: { title: Schema.String }, success: Schema.Void })],
	queries: [query("titles", { readPolicy: () => Effect.succeed(true), reads: () => [shelf.item(1)], success: Schema.Array(Schema.String) })],
});
