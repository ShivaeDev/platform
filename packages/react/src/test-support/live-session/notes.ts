import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { collection } from "@shivaedev/contract/keys.ts";
import { query } from "@shivaedev/contract/operation.ts";
import { Authenticated } from "@shivaedev/identity/middleware.ts";

export const notes = collection("notes", Schema.Number);
export const Notes = contract("liveSession", {
	keyScope: "session",
	queries: [query("get", { reads: () => [notes.item(0)], success: Schema.String })],
}).middleware(Authenticated);
