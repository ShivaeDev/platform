import { DateTime } from "effect";
import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";
import { answer } from "#test-support/answers.ts";

for (const clock of [undefined, DateTime.makeUnsafe("2100-01-01T00:00:00Z")]) {
	app.it(
		`after 30 days with ${clock === undefined ? "the default" : "an explicit"} clock, alice signs in again and keeps her notes`,
		[signedIn("alice")],
		function* ({ notesOf, signsInAgain, timePasses }) {
			const note = yield* notesOf("alice").create("A note to keep");
			yield* timePasses("30 days");
			expect(yield* answer(notesOf("alice").list())).toBe("sign in required");

			yield* signsInAgain("alice");

			expect(yield* notesOf("alice").list()).toEqual([note]);
		},
		clock === undefined ? undefined : { clock },
	);
}
