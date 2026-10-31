import * as PgTypes from "@effect/sql-pg/PgTypes";
import { expect } from "vitest";
import { storedColumn, tupleColumns } from "#test/tupleColumns.ts";
import type { TupleColumnType } from "#tupleIn.ts";

const cases = [
	["text", "NULL,{}\\\"'", "other"],
	["varchar", "one", "two"],
	["bpchar", "one", "two"],
	["name", "one", "two"],
	["int2", 1, 2],
	["int4", 1, 2],
	["int8", 9007199254740993n, 9007199254740994n],
	["oid", PgTypes.oid(1259), PgTypes.oid(1247)],
	["regclass", PgTypes.oid(1259), PgTypes.oid(1247)],
	["numeric", PgTypes.numeric("9007199254740993.123456789012"), PgTypes.numeric("9007199254740993.123456789013")],
	["float4", 1.25, 2.5],
	["float8", 1.125, 2.25],
	["bool", true, false],
	["uuid", "C14F367C-FDF0-4A8E-8BA4-DC72B0091EB0", "c14f367c-fdf0-4a8e-8ba4-dc72b0091eb1"],
	["bytea", new Uint8Array([0, 39, 92, 255]), new Uint8Array([0, 39, 92, 254])],
	["date", PgTypes.date("2026-10-31"), PgTypes.date("2026-11-01")],
	["time", PgTypes.time(123456789n), PgTypes.time(123456790n)],
	["timetz", PgTypes.timetz("12:34:56+02:00"), PgTypes.timetz("12:34:57+02:00")],
	["timestamp", PgTypes.timestamp(new Date("2026-10-31T12:34:56.789Z")), PgTypes.timestamp(new Date("2026-10-31T12:34:56.790Z"))],
	["timestamptz", new Date("2026-10-31T02:34:56.789-10:00"), new Date("2026-10-31T12:34:56.790Z")],
	["interval", PgTypes.interval({ days: 2, microseconds: 3n, months: 1 }), PgTypes.interval({ days: 2, microseconds: 4n, months: 1 })],
	["jsonb", PgTypes.jsonb({ name: "one", values: [1, null] }), PgTypes.jsonb({ name: "two", values: [1, null] })],
	["inet", PgTypes.inet("192.0.2.1"), PgTypes.inet("192.0.2.2")],
	["cidr", PgTypes.cidr("192.0.2.0/24"), PgTypes.cidr("198.51.100.0/24")],
] as const satisfies readonly (readonly [TupleColumnType, unknown, unknown])[];

for (const [type, first, second] of cases) {
	tupleColumns.it(
		`a ${type} array matches plain equality and keeps the tuple fields together`,
		[storedColumn(type, first, second)],
		function* ({ findEqual, findTuples }) {
			const equal = yield* findEqual(1, first);

			const found = yield* findTuples(type, [
				[1, first],
				[2, first],
				[3, second],
			]);

			expect(equal).toEqual([{ id: 1 }]);
			expect(found).toEqual(equal);
		},
	);
}

tupleColumns.it(
	"null tuple entries do not match null columns and duplicate tuples return a row once",
	[storedColumn("text", null, "second")],
	function* ({ findTuples }) {
		const found = yield* findTuples("text", [
			[1, null],
			[2, "second"],
			[2, "second"],
			[3, null],
		]);

		expect(found).toEqual([{ id: 2 }]);
	},
);

for (const type of ["int2", "int4", "int8", "numeric"] as const) {
	tupleColumns.it(`numeric strings encoded by a model match the ${type} column`, [storedColumn(type, 1, 2)], function* ({ findEncodedTuples }) {
		const found = yield* findEncodedTuples(type, [
			[1, 1],
			[2, 1],
			[3, 2],
		]);

		expect(found).toEqual([{ id: 1 }]);
	});
}

tupleColumns.it(
	"Date tuple parameters retain plain equality's session time zone conversion for timestamp columns",
	[storedColumn("timestamp", PgTypes.timestamp(new Date("2026-10-31T12:34:56.789Z")), PgTypes.timestamp(new Date("2026-10-31T12:34:57.789Z")))],
	function* ({ findEqual, findTuples }) {
		const instant = new Date("2026-10-31T12:34:56.789-10:00");
		const equal = yield* findEqual(1, instant, "Pacific/Honolulu");

		const found = yield* findTuples(
			"timestamp",
			[
				[1, instant],
				[2, instant],
			],
			"Pacific/Honolulu",
		);

		expect(equal).toEqual([{ id: 1 }]);
		expect(found).toEqual(equal);
	},
);

tupleColumns.it(
	"an array containing only null entries does not match null columns",
	[storedColumn("text", null, "second")],
	function* ({ findTuples }) {
		const found = yield* findTuples("text", [
			[1, null],
			[3, null],
		]);

		expect(found).toEqual([]);
	},
);
