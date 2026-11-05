import { Effect, Schema } from "effect";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";

export const Counter = contract("counter", {
	commands: [command("add", { invalidates: () => [], payload: { amount: Schema.Number }, success: Schema.Number })],
	queries: [query("value", { readPolicy: () => Effect.succeed(true), reads: () => [], success: Schema.Number })],
});
