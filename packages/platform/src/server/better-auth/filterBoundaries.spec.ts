import type { Where } from "better-auth";
import { Effect } from "effect";
import { expect } from "vitest";
import { filterCases } from "#test/auth/filterCases.ts";
import { auth, filterUsers, usersNamed } from "#test/auth/native.ts";

auth.it("preserves PostgreSQL null, membership, comparison and literal pattern semantics", [filterUsers], function* ({ findMany }) {
	for (const { expected, label, where } of filterCases) {
		const rows = yield* findMany({ where });
		expect(rows.map((row) => row.name).sort(), label).toEqual([...expected].sort());
	}
});
auth.it("orders, pages and projects Better Auth rows without losing the filter", [usersNamed("A", "B", "C")], function* ({ findMany }) {
	for (const direction of ["asc", "desc"] as const) {
		const rows = yield* findMany({
			limit: 1,
			offset: 1,
			select: ["name"],
			sortBy: { direction, field: "name" },
			where: [{ field: "name", operator: direction === "asc" ? "gte" : "lte", value: "B" }],
		});
		expect(rows).toEqual([{ name: direction === "asc" ? "C" : "A" }]);
	}
});
auth.it(
	"updates and deletes nonunique and OR filters and returns null for missing matches",
	[],
	function* ({ seedUser, update, count, delete: remove, userExists, findOne }) {
		const ids = [crypto.randomUUID(), crypto.randomUUID()];
		const email = `${crypto.randomUUID()}@example.test`;
		for (const [index, id] of ids.entries()) {
			yield* seedUser({ email: index === 0 ? email : email.toUpperCase(), id, name: "Shared" });
		}
		const shared: Where[] = [{ field: "name", operator: "eq", value: "Shared" }];
		expect(yield* update(shared, { name: "Changed" })).toMatchObject({ name: "Changed" });
		expect(yield* count([{ field: "name", value: "Changed" }])).toBe(2);
		expect(yield* update(shared, { name: "Missing" })).toBeNull();
		yield* update([{ field: "email", mode: "insensitive", value: email }], { name: "Insensitive" });
		expect(yield* count([{ field: "name", value: "Insensitive" }])).toBe(2);
		const alternatives: Where[] = ids.map((id) => ({ connector: "OR", field: "id", operator: "eq", value: id }));
		yield* update(alternatives, { name: "Alternatives" });
		expect(yield* count([{ field: "name", value: "Alternatives" }])).toBe(2);
		yield* remove(alternatives);
		for (const id of ids) {
			expect(yield* userExists(id)).toBe(false);
		}
		expect(yield* findOne([{ field: "id", value: ids[0] ?? "" }])).toBeNull();
	},
);
auth.it("rejects nonstring pattern filters with an actionable error", [], function* ({ count }) {
	expect(yield* Effect.flip(count([{ field: "name", operator: "contains", value: 1 }]))).toMatchObject({
		message: "contains requires a string value",
	});
});
auth.it("rejects native joins for both single and collection reads", [], function* ({ joinedRead }) {
	for (const many of [false, true]) {
		expect(yield* joinedRead(many)).toMatchObject({ message: "The Effect Prisma Better Auth adapter does not support native joins" });
	}
});
auth.it("maps configured model names by default", [], function* ({ configuredCount }) {
	expect(yield* configuredCount()).toBe(0);
});
auth.it("reports a configured Better Auth field missing from the generated database schema", [], function* ({ mismatchedField }) {
	for (const sort of [false, true]) {
		expect(yield* mismatchedField(sort)).toMatchObject({ message: "Unknown database field: missing_column" });
	}
});
