import { expect } from "vitest";
import { ownedData } from "#test/better-auth/ownedData.ts";
import {
	archivedNotes,
	authoredNotes,
	exportedTables,
	forgottenTable,
	passedUserReference,
	reviewedSettings,
} from "#test/better-auth/ownedTables.ts";

ownedData.it("the coverage check accepts owned notes and bookmarks beside auth's own tables", [exportedTables], function* ({ check }) {
	const coverage = yield* check();

	expect(coverage).toBe("covered");
});

ownedData.it(
	"the coverage check reports the cascading owner_id of a table without an owned model, but not its nulling editor_id, and passes once the table's model marks its owner",
	[exportedTables, forgottenTable],
	function* ({ check, gainsRepository }) {
		expect(yield* check()).toEqual([{ column: "owner_id", schema: "public", table: "forgotten" }]);

		yield* gainsRepository("forgotten");

		expect(yield* check()).toBe("covered");
	},
);

ownedData.it(
	"the coverage report tells the developer which column to mark and how",
	[exportedTables, forgottenTable],
	function* ({ coverageMessage }) {
		const message = yield* coverageMessage();

		expect(message).toBe(
			"Columns refer to a person, but no owned model covers them: public.forgotten.owner_id. Mark the column's field with owner from @shivaedev/sql/owner.ts on a model that has a repository, or declare its foreign key ON DELETE SET NULL when the row stays without the person",
		);
	},
);

ownedData.it(
	"the coverage check accepts an owned table's authored-by column that becomes null with its user",
	[exportedTables, authoredNotes],
	function* ({ check }) {
		const coverage = yield* check();

		expect(coverage).toBe("covered");
	},
);

ownedData.it(
	"the coverage check reports a column pointing at an owned table's owner column until its own model marks it as owner",
	[exportedTables, reviewedSettings],
	function* ({ check, gainsRepository }) {
		expect(yield* check()).toEqual([{ column: "reviewer_id", schema: "public", table: "reviews" }]);

		yield* gainsRepository("reviews");

		expect(yield* check()).toBe("covered");
	},
);

ownedData.it("the coverage check names a table in another schema", [exportedTables, archivedNotes], function* ({ check }) {
	const coverage = yield* check();

	expect(coverage).toEqual([{ column: "user_id", schema: "archive", table: "notes" }]);
});

ownedData.it(
	"the coverage check follows the user reference the application passes, reporting a column that points at members(id)",
	[exportedTables, forgottenTable, passedUserReference],
	function* ({ check }) {
		const coverage = yield* check();

		expect(coverage).toEqual([{ column: "owner_id", schema: "public", table: "forgotten" }]);
	},
);
