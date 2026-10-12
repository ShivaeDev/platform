import { Readable } from "node:stream";
import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { it } from "@shivaedev/effect-test/it.ts";
import { continuationMessage } from "#host/continuationMessage.ts";

it.effect("preserves argument and multiline stdin messages and refuses empty input", function* () {
	expect(yield* continuationMessage("Fix the checks", Readable.from([]))).toBe("Fix the checks");
	expect(yield* continuationMessage(undefined, Readable.from(["Fix the checks.\n", "Keep the PR.\n"]))).toBe("Fix the checks.\nKeep the PR.\n");
	for (const message of [undefined, " \n"]) {
		expect(yield* continuationMessage(message, Readable.from([])).pipe(Effect.flip)).toMatchObject({ _tag: "BadRequest" });
	}
});
