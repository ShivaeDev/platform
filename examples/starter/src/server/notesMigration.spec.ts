import { assertModelColumns } from "@shivaedev/effect-test-sql/assertModelColumns.ts";
import { beforeVersionedNotes, migration } from "#test-support/migration.ts";
import { StoredNote } from "./makeNotesRepository.ts";

migration.it(
	"upgrades the pre-version notes table to every current model column and PostgreSQL type",
	[beforeVersionedNotes()],
	function* ({ upgrade }) {
		const columns = yield* upgrade();
		yield* assertModelColumns(columns, StoredNote, { id: "integer", ownerId: "text", title: "text", version: "integer", wordCount: "integer" });
	},
);
