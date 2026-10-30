import { expect } from "vitest";
import { app, signedIn } from "#modules/notes/test-support/application.ts";

app.it("the bound socket client carries its cookie to a session-guarded query", [signedIn()], function* ({ actor, liveNotes }) {
	const note = yield* actor().notes.create({ title: "Alice's note" });

	const live = yield* liveNotes();

	expect(yield* live.nextNotes()).toEqual([note]);
});
