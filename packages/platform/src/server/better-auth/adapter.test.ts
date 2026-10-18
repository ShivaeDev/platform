import { expect } from "vitest";
import { auth } from "#test/auth/native.ts";

const rolledBackId = crypto.randomUUID();
function user(name: string, id = crypto.randomUUID()) {
	return { email: `${id}@example.test`, id, name };
}

auth.it("rolls back a failed Better Auth transaction outside the test harness", [], function* ({ failedTransaction, persistedUserExists }) {
	const data = user("Rollback");
	expect(yield* failedTransaction(data)).toMatchObject({ message: "rollback" });
	expect(yield* persistedUserExists(data.id)).toBe(false);
});
auth.it("shares the test rollback transaction with Better Auth adapter calls", [], function* ({ transactionCreate, userExists }) {
	const created = yield* transactionCreate(user("Auth", rolledBackId));
	expect(created.id).toBe(rolledBackId);
	expect(yield* userExists(rolledBackId)).toBe(true);
});
auth.it("rolls back Better Auth adapter calls", [], function* ({ userExists }) {
	expect(yield* userExists(rolledBackId)).toBe(false);
});
auth.it(
	"maps Better Auth reads, filters, updates, and deletes to Effect Prisma",
	[],
	function* ({ createUser, findOne, update, count, delete: remove, userExists }) {
		const data = user("Before");
		yield* createUser(data);
		const found = yield* findOne([{ field: "email", mode: "insensitive", operator: "eq", value: data.email.toUpperCase() }]);
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
