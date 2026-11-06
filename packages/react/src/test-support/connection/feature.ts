import { Effect, Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { query } from "@shivaedev/contract/operation.ts";

const read = query("get", {
	readPolicy: () => Effect.succeed(true),
	reads: () => [],
	success: Schema.String,
});
export const Notes = contract("connectionNotes", { queries: [read] });
export const Summary = contract("connectionSummary", { queries: [read] });
export const Api = Notes.merge(Summary);
