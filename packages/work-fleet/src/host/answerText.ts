import process from "node:process";
import { text } from "node:stream/consumers";
import { Effect } from "effect";
import { BadRequest } from "@shivaedev/effect-contract/errors/taxonomy.ts";

export function answerText(value: string | undefined) {
	if (value !== undefined || process.stdin.isTTY) {
		return Effect.succeed(value ?? "");
	}
	return Effect.tryPromise({ catch: () => new BadRequest({ message: "Could not read answer text from stdin" }), try: () => text(process.stdin) });
}
