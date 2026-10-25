import type { Where } from "better-auth";
import { Effect } from "effect";
import { expect } from "vitest";
import { filterAdapter } from "#test/auth/filterAdapter.ts";
import { filterCases, filterRows } from "#test/auth/filterCases.ts";

filterAdapter.it("preserves PostgreSQL null, membership, comparison and literal pattern semantics", [], function* ({ createUser, findMany }) {
	for (const row of filterRows) {
		yield* createUser({ ...row, email: `${crypto.randomUUID()}@example.test`, id: crypto.randomUUID() });
	}
	for (const { expected, label, where } of filterCases) {
		const rows = yield* findMany({ model: "user", where });
		expect(rows.map((row) => row.name).sort(), label).toEqual([...expected].sort());
	}
});
filterAdapter.it("orders, pages and projects Better Auth rows without losing the filter", [], function* ({ createUser, findMany }) {
	for (const name of ["A", "B", "C"]) {
		yield* createUser({ email: `${crypto.randomUUID()}@example.test`, id: crypto.randomUUID(), name });
	}
	for (const direction of ["asc", "desc"] as const) {
		const rows = yield* findMany({
			limit: 1,
			model: "user",
			offset: 1,
			select: ["name"],
			sortBy: { direction, field: "name" },
			where: [{ field: "name", operator: direction === "asc" ? "gte" : "lte", value: "B" }],
		});
		expect(rows).toEqual([{ name: direction === "asc" ? "C" : "A" }]);
	}
});
filterAdapter.it(
	"updates and deletes nonunique and OR filters and returns null for missing matches",
	[],
	function* ({ createUser, findMany, findOne, update, delete: deleteUsers, userExists }) {
		const ids = [crypto.randomUUID(), crypto.randomUUID()].sort();
		const email = `${crypto.randomUUID()}@example.test`;
		for (const [index, id] of ids.entries()) {
			yield* createUser({ email: index === 0 ? email : email.toUpperCase(), id, name: "Shared" });
		}
		const shared: Where[] = [{ field: "name", operator: "eq", value: "Shared" }];
		expect(yield* update(shared, { name: "Changed" })).toMatchObject({
			name: "Changed",
		});
		expect(
			yield* findMany({ model: "user", select: ["id"], sortBy: { direction: "asc", field: "id" }, where: [{ field: "name", value: "Changed" }] }),
		).toEqual(ids.map((id) => ({ id })));
		expect(yield* update(shared, { name: "Missing" })).toBeNull();
		yield* update([{ field: "email", mode: "insensitive", value: email }], { name: "Insensitive" });
		expect(
			yield* findMany({ model: "user", select: ["id"], sortBy: { direction: "asc", field: "id" }, where: [{ field: "name", value: "Insensitive" }] }),
		).toEqual(ids.map((id) => ({ id })));
		const alternatives: Where[] = ids.map((id) => ({ connector: "OR", field: "id", operator: "eq", value: id }));
		yield* update(alternatives, { name: "Alternatives" });
		expect(
			yield* findMany({
				model: "user",
				select: ["id"],
				sortBy: { direction: "asc", field: "id" },
				where: [{ field: "name", value: "Alternatives" }],
			}),
		).toEqual(ids.map((id) => ({ id })));
		yield* deleteUsers(alternatives);
		for (const id of ids) {
			expect(yield* userExists(id)).toBe(false);
		}
		expect(yield* findOne({ model: "user", where: [{ field: "id", value: ids[0] ?? "" }] })).toBeNull();
	},
);
filterAdapter.it("rejects nonstring pattern filters with an actionable error", [], function* ({ count }) {
	expect(yield* count([{ field: "name", operator: "contains", value: 1 }]).pipe(Effect.result)).toMatchObject({
		_tag: "Failure",
		failure: { message: expect.stringContaining("contains requires a string value") },
	});
});
filterAdapter.it("rejects native joins for both single and collection reads", [], function* ({ findOne, findMany }) {
	const input = { join: { session: true }, model: "user", where: [{ field: "id", value: crypto.randomUUID() }] };
	for (const query of [findOne, findMany]) {
		expect(yield* query(input, { advanced: { database: { joins: true } } }).pipe(Effect.result)).toMatchObject({
			_tag: "Failure",
			failure: { message: expect.stringContaining("The Effect Prisma Better Auth adapter does not support native joins") },
		});
	}
});
filterAdapter.it("maps configured model names by default", [], function* ({ count }) {
	expect(yield* count([], { user: { modelName: "authUser" } }, true)).toBe(0);
});
filterAdapter.it("reports a configured Better Auth field missing from the generated database schema", [], function* ({ count, findMany }) {
	const options = { user: { fields: { name: "missing_column" } } };
	for (const query of [
		count([{ field: "name", value: "Ada" }], options).pipe(Effect.result),
		findMany({ model: "user", sortBy: { direction: "asc", field: "missing_column" } }, options).pipe(Effect.result),
	]) {
		expect(yield* query).toMatchObject({
			_tag: "Failure",
			failure: { message: expect.stringContaining("Unknown database field: missing_column") },
		});
	}
});
