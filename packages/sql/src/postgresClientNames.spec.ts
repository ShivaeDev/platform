import { expect } from "vitest";
import { createdRow, customized, mapped, preserved } from "#test/clientNames.ts";

const original = new Date("2026-10-01T12:00:00.000Z");
const revised = new Date("2026-10-02T12:00:00.000Z");

mapped.it("inserts camelCase model fields into migration-created snake_case columns", [], function* ({ rows, sql, tableName }) {
	expect(yield* rows.insert({ createdAt: original, id: 1 })).toEqual({ createdAt: original, id: 1 });
	expect(yield* sql`select created_at from ${sql(tableName)}`.withoutTransform).toEqual([{ "created_at": original }]);
});

mapped.it("selects and filters snake_case columns through camelCase model fields", [createdRow(original)], function* ({ rows }) {
	expect(yield* rows.findById(1)).toEqual({ createdAt: original, id: 1 });
	expect(
		yield* rows.findMany({
			orderBy: { direction: "asc", field: "createdAt" },
			select: ["createdAt"],
			where: { createdAt: original },
		}),
	).toEqual([{ createdAt: original }]);
});

mapped.it("updates snake_case columns and decodes RETURNING into camelCase fields", [createdRow(original)], function* ({ rows, sql, tableName }) {
	expect(yield* rows.update({ createdAt: revised, id: 1 })).toEqual({ createdAt: revised, id: 1 });
	expect(yield* sql`select created_at from ${sql(tableName)}`.withoutTransform).toEqual([{ "created_at": revised }]);
});

mapped.it("raw SQL uses the same query identifiers and result names without aliases", [], function* ({ sql, tableName }) {
	yield* sql`insert into ${sql(tableName)} ${sql.insert({ createdAt: original, id: 1 })}`;
	expect(yield* sql`select created_at from ${sql(tableName)} where ${sql("createdAt")} = ${original}`).toEqual([{ createdAt: original }]);
});

preserved.it("opting out retains quoted camelCase columns and untransformed result names", [], function* ({ rows, sql, tableName }) {
	expect(yield* rows.insert({ createdAt: original, id: 1 })).toEqual({ createdAt: original, id: 1 });
	expect(yield* rows.findById(1)).toEqual({ createdAt: original, id: 1 });
	expect(yield* rows.update({ createdAt: revised, id: 1 })).toEqual({ createdAt: revised, id: 1 });
	expect(yield* sql`select "createdAt", id as row_id from ${sql(tableName)}`).toEqual([{ createdAt: revised, "row_id": 1 }]);
});

customized.it("explicit native transforms override the default names", [], function* ({ rows, sql, tableName }) {
	expect(yield* rows.insert({ createdAt: original, id: 1 })).toEqual({ createdAt: original, id: 1 });
	expect(yield* sql`select "createdAt", id as row_id from ${sql(tableName)}`).toEqual([{ createdAt: original, "row_id": 1 }]);
});
