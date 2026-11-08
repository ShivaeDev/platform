import { expect } from "vitest";
import { declarationStory } from "#test/declarationStory.ts";

for (const [kind, message] of [
	["duplicate queries", "Operation names must be unique; duplicated: same"],
	["duplicate query and command", "Operation names must be unique; duplicated: same"],
	["duplicate streams", "Operation names must be unique; duplicated: same"],
	["reserved query", "Operation name $changes is reserved for the built-in changes stream on contract notes"],
	["reserved command", "Operation name $changes is reserved for the built-in changes stream on contract notes"],
	["reserved stream", "Operation name $changes is reserved for the built-in changes stream on contract notes"],
] as const) {
	declarationStory.it(`the server reports ${kind} in the Effect boundary`, [], function* ({ validate }) {
		expect(yield* validate(kind)).toBe(message);
	});
}
