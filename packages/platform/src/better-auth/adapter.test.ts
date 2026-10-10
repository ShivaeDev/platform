import { expect } from "@effect/vitest";
import { Effect } from "effect";
import { afterAll, expect as expectPromise, it as vitestIt } from "vitest";
import { authDatabase, Database, integrationOptions, it, runtime } from "#test/auth/native.ts";

let rolledBackId = "";

afterAll(() => runtime.dispose());

vitestIt("rolls back a failed Better Auth transaction outside the test harness", integrationOptions, async () => {
	const id = crypto.randomUUID();
	const data = { email: `${id}@example.test`, id, name: "Rollback" };

	await expectPromise(
		authDatabase.transaction(async (transaction) => {
			await transaction.create<typeof data, typeof data>({
				data,
				forceAllowId: true,
				model: "user",
			});
			throw new Error("rollback");
		}),
	).rejects.toThrow("rollback");

	await expectPromise(
		runtime.runPromise(
			Effect.gen(function* () {
				const db = yield* Database;
				return yield* db.AuthUser.where({ id }).exists();
			}),
		),
	).resolves.toBe(false);
});

it.effectApp(
	"shares the test rollback transaction with Better Auth adapter calls",
	function* ({ promise, userExists }) {
		rolledBackId = crypto.randomUUID();
		const data = {
			email: `${crypto.randomUUID()}@example.test`,
			id: rolledBackId,
			name: "Auth",
		};
		const created = yield* promise(() =>
			authDatabase.transaction((transaction) =>
				transaction.create<typeof data, typeof data>({
					data,
					forceAllowId: true,
					model: "user",
				}),
			),
		);

		expect(created.id).toBe(rolledBackId);
		expect(yield* userExists(rolledBackId)).toBe(true);
	},
	integrationOptions,
);

it.effectApp(
	"rolls back Better Auth adapter calls",
	function* ({ userExists }) {
		expect(yield* userExists(rolledBackId)).toBe(false);
	},
	integrationOptions,
);

it.effectApp(
	"maps Better Auth reads, filters, updates, and deletes to Effect Prisma",
	function* ({ promise, userExists }) {
		const id = crypto.randomUUID();
		const email = `${id}@example.test`;
		const data = { email, id, name: "Before" };
		yield* promise(() =>
			authDatabase.create<typeof data, typeof data>({
				data,
				forceAllowId: true,
				model: "user",
			}),
		);

		const found = yield* promise(() =>
			authDatabase.findOne<typeof data>({
				model: "user",
				where: [
					{
						field: "email",
						mode: "insensitive",
						operator: "eq",
						value: email.toUpperCase(),
					},
				],
			}),
		);
		expect(found?.id).toBe(id);

		const updated = yield* promise(() =>
			authDatabase.update<typeof data>({
				model: "user",
				update: { name: "After" },
				where: [{ field: "id", operator: "eq", value: id }],
			}),
		);
		expect(updated?.name).toBe("After");

		expect(
			yield* promise(() =>
				authDatabase.count({
					model: "user",
					where: [{ field: "email", operator: "contains", value: id }],
				}),
			),
		).toBe(1);

		yield* promise(() =>
			authDatabase.delete({
				model: "user",
				where: [{ field: "id", operator: "eq", value: id }],
			}),
		);
		expect(yield* userExists(id)).toBe(false);
	},
	integrationOptions,
);

it.effectApp(
	"handles Better Auth's empty mutation filters deliberately",
	function* ({ promise }) {
		const first = {
			email: `${crypto.randomUUID()}@example.test`,
			id: crypto.randomUUID(),
			name: "First",
		};
		const second = {
			email: `${crypto.randomUUID()}@example.test`,
			id: crypto.randomUUID(),
			name: "Second",
		};
		for (const data of [first, second]) {
			yield* promise(() =>
				authDatabase.create<typeof data, typeof data>({
					data,
					forceAllowId: true,
					model: "user",
				}),
			);
		}

		expect(
			yield* promise(() =>
				authDatabase.update({
					model: "user",
					update: { name: "Nope" },
					where: [],
				}),
			),
		).toBeNull();
		expect(
			yield* promise(() =>
				authDatabase.updateMany({
					model: "user",
					update: { name: "Updated" },
					where: [],
				}),
			),
		).toBe(2);
		expect(yield* promise(() => authDatabase.deleteMany({ model: "user", where: [] }))).toBe(2);
	},
	integrationOptions,
);
