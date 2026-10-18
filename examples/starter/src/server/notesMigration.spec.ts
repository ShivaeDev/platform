import { expect } from "vitest";
import { app, notesPredatingSnakeCase, signedIn } from "#test-support/application.ts";
import { beforeVersionedNotes, migration } from "#test-support/migration.ts";

migration.it(
	"upgrades the pre-version notes table to every current model column and PostgreSQL type",
	[beforeVersionedNotes()],
	function* ({ upgrade }) {
		const columns = yield* upgrade();
		expect(columns).toEqual([
			{ name: "id", type: "integer" },
			{ name: "owner_id", type: "text" },
			{ name: "title", type: "text" },
			{ name: "version", type: "integer" },
			{ name: "word_count", type: "integer" },
		]);
	},
);

app.it(
	"a snake_case column upgrade preserves notes and their ownership through HTTP",
	[signedIn(), notesPredatingSnakeCase("Saved note")],
	function* ({ actor, existingNote, rerunMigrations }) {
		yield* rerunMigrations();
		const note = existingNote("Saved note");
		expect(yield* actor().notes.get({ id: note.id })).toEqual(note);
		expect(yield* actor().notes.update({ id: note.id, title: "Revised note", version: note.version })).toEqual({
			...note,
			title: "Revised note",
			version: note.version + 1,
		});
	},
);
