import { expect } from "vitest";
import { encodeStory } from "#test/encodeStory.ts";

for (const [operation, boundary] of [
	["save", "construction"],
	["saveEncoded", "encoding"],
] as const) {
	encodeStory.it(
		`a payload failing its struct check during ${boundary} returns a typed BadRequest without reaching the handler`,
		[],
		function* ({ received, save }) {
			const answer = yield* save(operation, 5, 2);

			expect(answer).toMatchObject({ message: expect.stringContaining("Start must precede end"), refusal: "BadRequest" });
			expect(received()).toEqual([]);
		},
	);

	encodeStory.it(`a valid command with ${boundary} checks preserves transformed fields`, [], function* ({ received, save }) {
		const answer = yield* save(operation, 2, 5);

		expect(answer).toBe("2 to 5");
		expect(received()).toEqual([{ end: 5, start: 2 }]);
	});
}
