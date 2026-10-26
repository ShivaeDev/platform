import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { accessStory } from "#test/accessStory.ts";

accessStory.it("stored role names decode to the application's role strings", [], function* ({ decodeRole }) {
	expect(yield* decodeRole("reader")).toBe("reader");
	expect(yield* decodeRole("manager")).toBe("manager");
	expect(yield* decodeRole("guest")).toBe("guest");
});

accessStory.it("an unknown stored role fails to decode", [], function* ({ decodeRole }) {
	const failure = yield* decodeRole("retired-role").pipe(Effect.flip);
	expect(failure).toBeInstanceOf(Schema.SchemaError);
});
