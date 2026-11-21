import { Effect, Option } from "effect";
import { readIfPresent, writeAtomically } from "#files.ts";

// Under check it writes nothing and says how the file differs from what generate would write.
export const settle = Effect.fn("Build.settle")(function* (check: boolean, output: string, content: string) {
	const existing = yield* readIfPresent(output);
	if (Option.contains(existing, content)) {
		return "current";
	}
	if (check) {
		return Option.isNone(existing) ? "missing" : "stale";
	}
	yield* writeAtomically(output, content);
	return "written";
});
