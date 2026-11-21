import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";

const tally = collection("record-tally", Schema.Number);

export const Tally = contract("tally", {
	commands: [command("bump", { invalidates: () => [tally.item(1)], success: Schema.Void })],
	queries: [query("count", { readPolicy: () => Effect.succeed(true), reads: () => [tally.item(1)], success: Schema.Number })],
});
