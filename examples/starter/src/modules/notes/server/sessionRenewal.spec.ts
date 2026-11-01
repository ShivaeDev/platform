import { DateTime } from "effect";
import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";
import { requestOutcome } from "#modules/notes/test-support/requestOutcome.ts";

for (const clock of [undefined, DateTime.makeUnsafe("2100-01-01T00:00:00Z")]) {
	app.it(
		`alice signs in again after 30 days with ${clock === undefined ? "the default" : "an explicit"} clock and keeps her notes`,
		[signedIn()],
		function* ({ actor, signsInAgain, timePasses }) {
			const original = actor();
			const note = yield* original.notes.create({ title: "A note to keep" });

			yield* timePasses("30 days");

			expect(yield* requestOutcome(original.notes.list())).toBe("sign in required");

			yield* signsInAgain();

			expect(actor().userId).toBe(original.userId);
			expect(yield* actor().notes.list()).toEqual([note]);
		},
		clock === undefined ? undefined : { clock },
	);
}
