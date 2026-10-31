import { Effect } from "effect";
import { expect } from "vitest";
import { NotFound } from "@shivaedev/errors/taxonomy.ts";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it("bob receives the same NotFound for alice's private note and a nonexistent note", [signedIn(), signedIn("bob")], function* ({ actor }) {
	const alice = actor().notes;
	const bob = actor("bob").notes;
	const note = yield* alice.create({ title: "Alice's private note" });

	const privateAnswer = yield* bob.get({ id: note.id }).pipe(Effect.flip);
	const missingAnswer = yield* bob.get({ id: -1 }).pipe(Effect.flip);

	expect(privateAnswer).toBeInstanceOf(NotFound);
	expect(missingAnswer).toBeInstanceOf(NotFound);
	expect(privateAnswer).toMatchObject({ _tag: "NotFound", message: "Note not found" });
	expect(missingAnswer).toEqual(privateAnswer);
});
