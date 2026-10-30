import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { emptyDatabase, templates } from "#test/templates.ts";

templates.it(
	"a migrated story starts with the template's applied migrations, its fixtures and the row a loader wrote through the template URL",
	[],
	function* ({ appliedMigrations, items, loaderRows }) {
		yield* outcomes({
			"applied migrations": [appliedMigrations(), [1]],
			items: [items(), ["seed"]],
			"the loader's row": [loaderRows(), ["written in the migrated template"]],
		});
	},
);

templates.it(
	"every story sees preparation run the migrations and the fixture loader once, with the loader's resources released",
	[],
	function* ({ loaderResources, preparationRuns }) {
		yield* outcomes({
			"preparation runs": [preparationRuns(), { fixtures: 1, loaders: 1, migrations: 1 }],
			"the loader's resources": [loaderResources(), "released"],
		});
	},
);

templates.it("a story that starts from the empty template has no tables", [emptyDatabase], function* ({ tables }) {
	expect(yield* tables()).toEqual([]);
});

templates.it(
	"a change a story commits in its database does not reach the next clone of the template",
	[],
	function* ({ changeItem, items, itemsInNewClone }) {
		expect(yield* items()).toEqual(["seed"]);

		yield* changeItem("committed");

		yield* outcomes({
			"items in a new clone": [itemsInNewClone(), ["seed"]],
			"items in the story's database": [items(), ["committed"]],
		});
	},
);

for (const [template, tables] of [
	["empty", []],
	["migrated", ["app_options_fixture", "effect_sql_migrations", "items", "notes"]],
] as const) {
	templates.it(
		`inside a story on the empty template, an isolated block on the ${template} template has ${tables.length === 0 ? "no tables" : "the migrated tables"}`,
		[emptyDatabase],
		function* ({ tablesInNewClone }) {
			expect(yield* tablesInNewClone(template)).toEqual(tables);
		},
	);
}
