import { expect } from "vitest";
import { emptyDatabase, templates } from "#test/templates.ts";

templates.it(
	"a migrated story inherits migrations and URL-bound fixtures without running them",
	[],
	function* ({ readLedger, readFixture, readItems, readPreparation, changeItem }) {
		expect(yield* readLedger()).toEqual([{ id: 1 }]);
		expect(yield* readItems()).toEqual([{ value: "seed" }]);
		const prepared = yield* readPreparation();
		expect(prepared).toMatchObject({ fixtures: 1, loaders: 1, migrations: 1, released: 1 });
		expect(prepared.url).toMatch(/^effect_test_/u);
		expect(yield* readFixture()).toEqual([{ template: prepared.url }]);
		yield* changeItem("committed");
		expect(yield* readItems()).toEqual([{ value: "committed" }]);
	},
);

templates.it("an upgrade trait selects an empty clone from the same layer", [emptyDatabase], function* ({ readSchema, readPreparation }) {
	expect(yield* readSchema()).toEqual([]);
	expect(yield* readPreparation()).toMatchObject({ fixtures: 1, loaders: 1, migrations: 1, released: 1 });
});

templates.it(
	"another migrated story reuses preparation and starts with unchanged fixtures",
	[],
	function* ({ readItems, readLedger, readPreparation }) {
		expect(yield* readItems()).toEqual([{ value: "seed" }]);
		expect(yield* readLedger()).toEqual([{ id: 1 }]);
		expect(yield* readPreparation()).toMatchObject({ fixtures: 1, loaders: 1, migrations: 1, released: 1 });
	},
);

templates.it("an isolated block selects either template even inside an empty story", [emptyDatabase], function* ({ readNestedSchema, readSchema }) {
	expect(yield* readNestedSchema("empty")).toEqual([]);
	expect(yield* readNestedSchema("migrated")).toEqual([
		{ name: "app_options_fixture" },
		{ name: "effect_sql_migrations" },
		{ name: "items" },
		{ name: "notes" },
	]);
	expect(yield* readSchema()).toEqual([]);
});
