import { Effect } from "effect";
import { expect } from "vitest";
import { auth } from "#test/auth/native.ts";

function user(name: string) {
	const id = crypto.randomUUID();
	return { email: `${id}@example.test`, id, name };
}

auth.it("rolls back a failed Better Auth transaction outside the test harness", [], function* ({ transaction, persistedUserExists }) {
	const data = user("Rollback");
	const failure = yield* Effect.flip(
		transaction(async (adapter) => {
			await adapter.create({ data, forceAllowId: true, model: "user" });
			throw new Error("rollback");
		}, "runtime"),
	);
	expect(failure).toMatchObject({ message: "rollback" });
	expect(yield* persistedUserExists(data.id)).toBe(false);
});
auth.it("shares the test rollback transaction with Better Auth adapter calls", [], function* ({ transaction, userExists }) {
	const data = user("Auth");
	const created = yield* transaction((adapter) => adapter.create<typeof data>({ data, forceAllowId: true, model: "user" }));
	expect(created.id).toBe(data.id);
	expect(yield* userExists(data.id)).toBe(true);
});
auth.it("rolls back Better Auth adapter calls", [], function* ({ rollbackTransaction, persistedUserExists }) {
	const data = user("Rolled back");
	const created = yield* rollbackTransaction(async (adapter) => {
		const row = await adapter.create<typeof data>({ data, forceAllowId: true, model: "user" });
		expect(await adapter.findOne<typeof data>({ model: "user", where: [{ field: "id", value: data.id }] })).toMatchObject(data);
		return row;
	});
	expect(created.id).toBe(data.id);
	expect(yield* persistedUserExists(data.id)).toBe(false);
});
auth.it(
	"maps Better Auth reads, filters, updates, and deletes to Effect Prisma",
	[],
	function* ({ createUser, findOne, update, count, delete: remove, userExists }) {
		const data = user("Before");
		yield* createUser(data);
		const found = yield* findOne({ where: [{ field: "email", mode: "insensitive", operator: "eq", value: data.email.toUpperCase() }] });
		expect(found?.id).toBe(data.id);
		const updated = yield* update([{ field: "id", operator: "eq", value: data.id }], { name: "After" });
		expect(updated?.name).toBe("After");
		expect(yield* count([{ field: "email", operator: "contains", value: data.id }])).toBe(1);
		yield* remove([{ field: "id", operator: "eq", value: data.id }]);
		expect(yield* userExists(data.id)).toBe(false);
	},
);
auth.it("handles Better Auth's empty mutation filters deliberately", [], function* ({ createUser, update, updateMany, deleteMany }) {
	for (const name of ["First", "Second"]) {
		yield* createUser(user(name));
	}
	expect(yield* update([], { name: "Nope" })).toBeNull();
	expect(yield* updateMany([], { name: "Updated" })).toBe(2);
	expect(yield* deleteMany([])).toBe(2);
});
