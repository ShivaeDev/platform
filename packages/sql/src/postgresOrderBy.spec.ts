import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { hasPostgresInvoiceLines } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";

postgres.it("findMany breaks ties by the next field in list order", [hasPostgresInvoiceLines()], function* ({ invoiceLines }) {
	const { lines } = invoiceLines();
	yield* lines.insertMany([
		{ amount: 1, name: "B", note: null },
		{ amount: 1, name: "A", note: null },
		{ amount: 1, name: "B", note: null },
		{ amount: 1, name: "A", note: null },
	]);
	expect(
		yield* lines.findMany({
			orderBy: [
				{ direction: "asc", field: "name" },
				{ direction: "asc", field: "id" },
			],
			select: ["id"],
		}),
	).toEqual([{ id: 2 }, { id: 4 }, { id: 1 }, { id: 3 }]);
	expect(
		yield* lines.findMany({
			orderBy: [
				{ direction: "asc", field: "id" },
				{ direction: "asc", field: "name" },
			],
			select: ["id"],
		}),
	).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }]);
});

postgres.it("findMany applies mixed directions before limiting rows", [hasPostgresInvoiceLines()], function* ({ invoiceLines }) {
	const { lines } = invoiceLines();
	yield* lines.insertMany([
		{ amount: 1, name: "B", note: null },
		{ amount: 1, name: "A", note: null },
		{ amount: 1, name: "B", note: null },
		{ amount: 1, name: "A", note: null },
	]);
	expect(
		yield* lines.findMany({
			limit: 3,
			orderBy: [
				{ direction: "asc", field: "name" },
				{ direction: "desc", field: "id" },
			],
			select: ["id"],
		}),
	).toEqual([{ id: 4 }, { id: 2 }, { id: 3 }]);
});

postgres.it("findMany accepts a single ordering object or a one-entry list", [hasPostgresInvoiceLines()], function* ({ invoiceLines }) {
	const { lines } = invoiceLines();
	yield* lines.insertMany([
		{ amount: 1, name: "A", note: null },
		{ amount: 1, name: "B", note: null },
	]);
	expect(yield* lines.findMany({ orderBy: { direction: "desc", field: "id" }, select: ["id"] })).toEqual([{ id: 2 }, { id: 1 }]);
	expect(yield* lines.findMany({ orderBy: [{ direction: "desc", field: "id" }], select: ["id"] })).toEqual([{ id: 2 }, { id: 1 }]);
});

postgres.it("findMany rejects unknown runtime fields in every ordering position", [hasPostgresInvoiceLines()], function* ({ invoiceLines }) {
	const { lines } = invoiceLines();
	const field: "name" = JSON.parse('"missing"');
	for (const orderBy of [
		{ direction: "asc", field },
		[
			{ direction: "asc", field },
			{ direction: "desc", field: "id" },
		],
		[
			{ direction: "asc", field: "id" },
			{ direction: "desc", field },
		],
	] as const) {
		const failure = yield* lines.findMany({ orderBy }).pipe(Effect.flip);
		expect(failure).toBeInstanceOf(Schema.SchemaError);
		expect(failure.message).toContain("missing");
	}
});
