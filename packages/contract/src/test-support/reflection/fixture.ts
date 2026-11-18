import { Effect, Schema } from "effect";
import { collection } from "@shivaedev/changes/keys.ts";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import { contract } from "#contract.ts";
import { command, query } from "#operation.ts";

export const board = collection("reflection-board", Schema.Number);

export const Board = contract("board", {
	commands: [
		command("write", { invalidates: () => [board.item(1)], payload: { value: Schema.String }, rejections: { Conflict }, success: Schema.Void }),
		command("touch", { invalidates: () => [], success: Schema.Void }),
	],
	queries: [query("shown", { readPolicy: () => Effect.succeed(true), reads: () => [board.item(1)], success: Schema.String })],
});
