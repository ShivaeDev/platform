import { expect } from "vitest";
import { columns } from "#test/columns.ts";

columns.it(
	"without migrations, the readout returns live columns and exact types in name order and excludes a dropped column",
	[],
	function* ({ createTable, dropColumn, readColumns }) {
		yield* createTable();
		expect(yield* readColumns("items")).toEqual([
			{ name: "id", type: "integer" },
			{ name: "removed", type: "boolean" },
			{ name: "unit_price", type: "numeric(10,2)" },
		]);

		yield* dropColumn();

		expect(yield* readColumns("items")).toEqual([
			{ name: "id", type: "integer" },
			{ name: "unit_price", type: "numeric(10,2)" },
		]);
	},
);

columns.it(
	"a schema-qualified quoted table returns its stored column names despite client name transforms",
	[],
	function* ({ createQuotedTable, readColumns }) {
		yield* createQuotedTable();

		expect(yield* readColumns('public."Items"')).toEqual([
			{ name: "displayName", type: "character varying(30)" },
			{ name: "run_id", type: "bigint" },
		]);
	},
);
