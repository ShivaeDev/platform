import { Schema } from "effect";
import { contract } from "@shivaedev/effect-contract/contract.ts";
import { collection } from "@shivaedev/effect-contract/keys.ts";
import { query } from "@shivaedev/effect-contract/operation.ts";
import { Authenticated } from "@shivaedev/platform/rpc/middleware.ts";

export const notes = collection("notes", Schema.Number);
export const Notes = contract("liveSession", {
	queries: [query("get", { reads: () => [notes.list], success: Schema.String })],
}).middleware(Authenticated);
