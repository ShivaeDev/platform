import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { partialWrites, profileStored } from "#test/partialWrites.ts";

for (const columns of [[], ["id"], ["missing"]]) {
	partialWrites.it(
		`chosen-column update rejects ${JSON.stringify(columns)} before SQL, keeps the name and publishes nothing`,
		[profileStored()],
		function* ({ updateWithColumns, profile, publications, statementKinds, endings }) {
			yield* updateWithColumns(columns);

			yield* outcomes([
				["write ending", () => endings(), ["failed with a schema error"]],
				["write statements", () => statementKinds(), []],
				["stored profile", () => profile(), { name: "Draft" }],
				["published keys", () => publications(), []],
			]);
		},
	);
}

partialWrites.it(
	"a selected optional column without a supplied value fails before SQL, keeps the note and publishes nothing",
	[profileStored()],
	function* ({ updateMissingNote, profile, publications, statementKinds, endings }) {
		yield* updateMissingNote();

		yield* outcomes([
			["write ending", () => endings(), ["failed with a schema error"]],
			["write statements", () => statementKinds(), []],
			["stored profile", () => profile(), { note: null }],
			["published keys", () => publications(), []],
		]);
	},
);
