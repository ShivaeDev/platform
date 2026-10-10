import { Effect } from "effect";
import { expect, it as plainIt } from "vitest";
import { it } from "#it.ts";

const executed: string[] = [];

it.effect.skipIf(true)("skips the body behind a true condition", function* () {
	executed.push("skipped body");
	return yield* Effect.die("skipped tests never run");
});

plainIt("does not execute the skipped body", () => {
	expect(executed).toEqual([]);
});
