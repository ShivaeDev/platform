import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { app, malformedSourceNote, signedIn, sourceNoteMissing } from "#modules/notes/test-support/application.ts";

app.it("imports a source title into alice's persisted notes through outbound HTTP", [signedIn()], function* ({ actor, storedNotes, sourceRequests }) {
	const { notes } = actor();
	expect(yield* notes.list()).toEqual([]);

	const imported = yield* notes.import({ id: 7 });

	expect(imported.title).toBe("A note from outside");
	yield* outcomes({
		"alice's notes": [notes.list(), [imported]],
		"persisted notes": [storedNotes(), [expect.objectContaining(imported)]],
	});
	expect(sourceRequests()).toEqual([{ method: "GET", path: "/posts/7", status: HttpStatus.fromLiteral("OK") }]);
});

app.it(
	"returns a typed not-found failure for an error status without saving a note",
	[sourceNoteMissing(), signedIn()],
	function* ({ actor, sourceRequests }) {
		const { notes } = actor();
		expect(yield* notes.list()).toEqual([]);

		const failure = yield* notes.import({ id: 7 }).pipe(Effect.flip);

		expect(failure).toBeInstanceOf(NotFound);
		expect(failure.message).toBe("Source note not found");
		expect(yield* notes.list()).toEqual([]);
		expect(sourceRequests()).toEqual([{ method: "GET", path: "/posts/7", status: HttpStatus.fromLiteral("NotFound") }]);
	},
);

app.it(
	"returns a typed unavailable failure for a malformed source body without saving a note",
	[malformedSourceNote(), signedIn()],
	function* ({ actor }) {
		const { notes } = actor();
		expect(yield* notes.list()).toEqual([]);

		const failure = yield* notes.import({ id: 7 }).pipe(Effect.flip);

		expect(failure).toBeInstanceOf(ServiceUnavailable);
		expect(failure.message).toBe("Could not read the source note");
		expect(yield* notes.list()).toEqual([]);
	},
);
