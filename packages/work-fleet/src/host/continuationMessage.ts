import process from "node:process";
import type { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import { Effect } from "effect";
import { BadRequest } from "@shivaedev/effect-contract/errors/taxonomy.ts";

export function continuationMessage(message: string | undefined, input: Readable = process.stdin) {
	const failure = new BadRequest({ message: "Supply a continuation message as an argument or on stdin" });
	if (message === undefined && input === process.stdin && process.stdin.isTTY) {
		return Effect.fail(failure);
	}
	const read = message === undefined ? Effect.tryPromise({ catch: () => failure, try: () => text(input) }) : Effect.succeed(message);
	return read.pipe(
		Effect.filterOrFail(
			(value) => value.trim().length > 0,
			() => failure,
		),
	);
}
