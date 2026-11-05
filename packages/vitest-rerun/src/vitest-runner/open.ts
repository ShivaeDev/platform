import { Effect } from "effect";
import { type RunOptions, VitestRuntime } from "#VitestRuntime.ts";

export const open = Effect.fn("VitestRunner.open")(function* (input: RunOptions) {
	const runtime = yield* VitestRuntime;
	return yield* runtime.open(input);
});
