import { Context, Effect, Option, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";

export const notes = collection("notes", Schema.Number);
export class ReadAccess extends Context.Service<ReadAccess, () => boolean>()("test/LiveReadAccess") {}
export const Notes = contract("liveSession", {
	keyScope: "session",
	queries: [
		query("get", {
			readPolicy: (_input, viewer) => Effect.map(ReadAccess, (allowed) => Option.isSome(viewer) && allowed()),
			reads: () => [notes.item(0)],
			success: Schema.String,
		}),
	],
}).middleware(Authenticated);
