import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";
import { answer } from "#test-support/answers.ts";

app.it(
	"alice's eleventh note creation is refused over HTTP while bob can still create",
	[signedIn("alice"), signedIn("bob")],
	function* ({ notesOf }) {
		const alice = notesOf("alice");
		for (let index = 0; index < 10; index += 1) {
			yield* alice.create(`Alice note ${index}`);
		}

		const refused = yield* answer(alice.create("Excess note"));

		expect(refused).toBe("too many requests");
		expect((yield* alice.list()).map((note) => note.title)).not.toContain("Excess note");
		const bob = yield* notesOf("bob").create("Bob note");
		expect(bob.title).toBe("Bob note");
	},
);
