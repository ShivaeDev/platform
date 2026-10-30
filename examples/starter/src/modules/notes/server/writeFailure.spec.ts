import { Effect } from "effect";
import { expect } from "vitest";
import { app, constrainedTitles, signedIn } from "#modules/notes/test-support/application.ts";

app.it("reports a PostgreSQL constraint violation to the client as a conflict", [signedIn(), constrainedTitles()], function* ({ actor }) {
	const failure = yield* actor().notes.create({ title: "Reserved" }).pipe(Effect.flip);

	expect(failure).toMatchObject({ _tag: "Conflict", message: "The note violates a database constraint" });
	expect(yield* actor().notes.list()).toEqual([]);
});
