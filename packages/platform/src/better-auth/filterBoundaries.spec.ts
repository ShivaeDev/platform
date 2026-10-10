import { expect } from "@effect/vitest";
import type { Where } from "better-auth";
import { afterAll, expect as expectPromise, it as vitestIt } from "vitest";
import { effectPrismaAdapter } from "#better-auth/adapter.ts";
import { filterCases, filterRows } from "#test/auth/filterCases.ts";
import { authDatabase, Database, integrationOptions, it, runtime } from "#test/auth/native.ts";

afterAll(() => runtime.dispose());

it.effectApp(
	"preserves PostgreSQL null, membership, comparison and literal pattern semantics",
	function* ({ db, promise }) {
		for (const row of filterRows) {
			yield* db.AuthUser.create({ ...row, email: `${crypto.randomUUID()}@example.test`, id: crypto.randomUUID() });
		}
		for (const { expected, label, where } of filterCases) {
			const rows = yield* promise(() => authDatabase.findMany<{ name: string }>({ model: "user", where }));
			expect(rows.map((row) => row.name).sort(), label).toEqual([...expected].sort());
		}
	},
	integrationOptions,
);

it.effectApp(
	"orders, pages and projects Better Auth rows without losing the filter",
	function* ({ db, promise }) {
		for (const name of ["A", "B", "C"]) {
			yield* db.AuthUser.create({ email: `${crypto.randomUUID()}@example.test`, id: crypto.randomUUID(), name });
		}
		for (const direction of ["asc", "desc"] as const) {
			const rows = yield* promise(() =>
				authDatabase.findMany<{ name: string }>({
					limit: 1,
					model: "user",
					offset: 1,
					select: ["name"],
					sortBy: { direction, field: "name" },
					where: [{ field: "name", operator: direction === "asc" ? "gte" : "lte", value: "B" }],
				}),
			);
			expect(rows).toEqual([{ name: direction === "asc" ? "C" : "A" }]);
		}
	},
	integrationOptions,
);

it.effectApp(
	"updates and deletes nonunique and OR filters and returns null for missing matches",
	function* ({ db, promise, userExists }) {
		const ids = [crypto.randomUUID(), crypto.randomUUID()];
		const email = `${crypto.randomUUID()}@example.test`;
		for (const [index, id] of ids.entries()) {
			yield* db.AuthUser.create({ email: index === 0 ? email : email.toUpperCase(), id, name: "Shared" });
		}
		const shared: Where[] = [{ field: "name", operator: "eq", value: "Shared" }];
		expect(yield* promise(() => authDatabase.update<{ name: string }>({ model: "user", update: { name: "Changed" }, where: shared }))).toMatchObject({
			name: "Changed",
		});
		expect(yield* promise(() => authDatabase.count({ model: "user", where: [{ field: "name", value: "Changed" }] }))).toBe(2);
		expect(yield* promise(() => authDatabase.update({ model: "user", update: { name: "Missing" }, where: shared }))).toBeNull();
		yield* promise(() =>
			authDatabase.update({
				model: "user",
				update: { name: "Insensitive" },
				where: [{ field: "email", mode: "insensitive", value: email }],
			}),
		);
		expect(yield* promise(() => authDatabase.count({ model: "user", where: [{ field: "name", value: "Insensitive" }] }))).toBe(2);
		const alternatives: Where[] = ids.map((id) => ({ connector: "OR", field: "id", operator: "eq", value: id }));
		yield* promise(() => authDatabase.update({ model: "user", update: { name: "Alternatives" }, where: alternatives }));
		expect(yield* promise(() => authDatabase.count({ model: "user", where: [{ field: "name", value: "Alternatives" }] }))).toBe(2);
		yield* promise(() => authDatabase.delete({ model: "user", where: alternatives }));
		for (const id of ids) {
			expect(yield* userExists(id)).toBe(false);
		}
		expect(yield* promise(() => authDatabase.findOne({ model: "user", where: [{ field: "id", value: ids[0] ?? "" }] }))).toBeNull();
	},
	integrationOptions,
);

it.effectApp(
	"rejects nonstring pattern filters with an actionable error",
	function* ({ promise }) {
		yield* promise(() =>
			expectPromise(authDatabase.count({ model: "user", where: [{ field: "name", operator: "contains", value: 1 }] })).rejects.toThrow(
				"contains requires a string value",
			),
		);
	},
	integrationOptions,
);

vitestIt("rejects experimental native joins for both single and collection reads", integrationOptions, async () => {
	const nativeJoins = effectPrismaAdapter(Database, runtime, { modelName: () => "AuthUser" })({ experimental: { joins: true } });
	const input = { join: { session: true }, model: "user", where: [{ field: "id", value: crypto.randomUUID() }] };
	for (const query of [() => nativeJoins.findOne(input), () => nativeJoins.findMany(input)]) {
		await expectPromise(query()).rejects.toThrow("The Effect Prisma Better Auth adapter does not support experimental native joins");
	}
});

it.effectApp(
	"maps configured model names by default",
	function* ({ promise }) {
		const configured = effectPrismaAdapter(Database, runtime)({ user: { modelName: "authUser" } });
		expect(yield* promise(() => configured.count({ model: "user", where: [] }))).toBe(0);
	},
	integrationOptions,
);

it.effectApp(
	"reports a configured Better Auth field missing from the generated database schema",
	function* ({ promise }) {
		const mismatched = effectPrismaAdapter(Database, runtime, { modelName: () => "AuthUser" })({
			user: { fields: { name: "missing_column" } },
		});
		yield* promise(() =>
			expectPromise(mismatched.count({ model: "user", where: [{ field: "name", value: "Ada" }] })).rejects.toThrow(
				"Unknown database field: missing_column",
			),
		);
		yield* promise(() =>
			expectPromise(mismatched.findMany({ model: "user", sortBy: { direction: "asc", field: "missing_column" } })).rejects.toThrow(
				"Unknown database field: missing_column",
			),
		);
	},
	integrationOptions,
);
