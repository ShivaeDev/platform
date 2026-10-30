import { Effect } from "effect";
import { TestOutput } from "#TestOutput.ts";

export function testOutput() {
	return Effect.runSync(TestOutput.pipe(Effect.provide(TestOutput.layer)));
}
