import type { Readable } from "node:stream";
import { text } from "node:stream/consumers";
import { Effect } from "effect";
import { FleetFailure } from "#policy.ts";

export function continuationMessage(message: string | undefined, input: Readable = process.stdin) {
	const failure = new FleetFailure({ message: "Supply a continuation message as an argument or on stdin", reason: "invalid" });
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
