import { expect } from "@effect/vitest";
import { exceptionStory } from "#test/exceptionStory.ts";

const REASON = "Compile-time proof that the types reject the value.";
exceptionStory.it("is empty when it is missing", [], function* ({ decodeRegistry }) {
	expect(yield* decodeRegistry(undefined)).toEqual({ _tag: "Valid", value: [] });
});

for (const [label, text] of [
	["a missing reason", JSON.stringify([{ file: "a.ts", rule: "x" }])],
	["a blank reason", JSON.stringify([{ file: "a.ts", reason: "  ", rule: "x" }])],
	["an unknown field", JSON.stringify([{ file: "a.ts", pragma: "@ts-expect-error", reason: REASON, rule: "x" }])],
	["an object instead of a list", JSON.stringify({ file: "a.ts", reason: REASON, rule: "x" })],
	["text that is not JSON", "[{"],
] satisfies ReadonlyArray<readonly [unknown, unknown]>) {
	exceptionStory.it(`is refused with ${label}`, [], function* ({ decodeRegistry }) {
		expect(yield* decodeRegistry(text)).toMatchObject({ _tag: "Invalid" });
	});
}
