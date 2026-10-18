import type { Where } from "better-auth";
import { Effect } from "effect";
import { expect } from "vitest";
import { filterCases } from "#test/auth/filterCases.ts";
import { auth, configuredAdapter, filterUsers, usersNamed, usersWith } from "#test/auth/native.ts";

const sharedEmail = `${crypto.randomUUID()}@example.test`;
const sharedUsers = [
	{ email: sharedEmail, id: crypto.randomUUID(), name: "Shared" },
	{ email: sharedEmail.toUpperCase(), id: crypto.randomUUID(), name: "Shared" },
] as const;

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
	[usersWith(...sharedUsers)],
	function* ({ update, count, delete: remove, userExists, findOne }) {
		const shared: Where[] = [{ field: "name", operator: "eq", value: "Shared" }];
		expect(yield* update(shared, { name: "Changed" })).toMatchObject({ name: "Changed" });
		expect(yield* count([{ field: "name", value: "Changed" }])).toBe(2);
		expect(yield* update(shared, { name: "Missing" })).toBeNull();
		yield* update([{ field: "email", mode: "insensitive", value: sharedEmail }], { name: "Insensitive" });
		expect(yield* count([{ field: "name", value: "Insensitive" }])).toBe(2);
		const alternatives: Where[] = sharedUsers.map(({ id }) => ({ connector: "OR", field: "id", operator: "eq", value: id }));
		yield* update(alternatives, { name: "Alternatives" });
		expect(yield* count([{ field: "name", value: "Alternatives" }])).toBe(2);
		yield* remove(alternatives);
		for (const { id } of sharedUsers) {
			expect(yield* userExists(id)).toBe(false);
		}
		expect(yield* findOne({ where: [{ field: "id", value: sharedUsers[0].id }] })).toBeNull();
	},
);
auth.it("rejects nonstring pattern filters with an actionable error", [], function* ({ count }) {
	expect(yield* Effect.flip(count([{ field: "name", operator: "contains", value: 1 }]))).toMatchObject({
		message: "contains requires a string value",
	});
});
auth.it(
	"rejects native joins for both single and collection reads",
	[configuredAdapter({ advanced: { database: { joins: true } } })],
	function* ({ findOne, findMany }) {
		const input = { join: { session: true }, where: [{ field: "id", value: crypto.randomUUID() }] };
		expect(yield* Effect.flip(findOne(input))).toMatchObject({ message: "The Effect Prisma Better Auth adapter does not support native joins" });
		expect(yield* Effect.flip(findMany(input))).toMatchObject({ message: "The Effect Prisma Better Auth adapter does not support native joins" });
	},
);
auth.it("maps configured model names by default", [configuredAdapter({ user: { modelName: "authUser" } }, {})], function* ({ count }) {
	expect(yield* count([])).toBe(0);
});
auth.it(
	"reports a configured Better Auth field missing from the generated database schema",
	[configuredAdapter({ user: { fields: { name: "missing_column" } } })],
	function* ({ count, findMany }) {
		expect(yield* Effect.flip(count([{ field: "name", value: "Ada" }]))).toMatchObject({ message: "Unknown database field: missing_column" });
		expect(yield* Effect.flip(findMany({ sortBy: { direction: "asc", field: "missing_column" } }))).toMatchObject({
			message: "Unknown database field: missing_column",
		});
	},
);
