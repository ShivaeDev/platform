import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";

const notes = collection("restart-notes", Schema.Number);
export const RestartNotes = contract("restartNotes", {
	queries: [
		query("get", {
			payload: { id: Schema.Number, tab: Schema.String },
			readPolicy: () => Effect.succeed(true),
			reads: ({ id }) => [notes.item(id)],
			success: Schema.Struct({ id: Schema.Number, pid: Schema.Number, readAt: Schema.Number, tab: Schema.String }),
		}),
	],
});
