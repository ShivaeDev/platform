import { Effect, Option } from "effect";
import { expect } from "vitest";
import { Account, Prefix } from "#test/conflictAccounts.ts";
import { hasConflictAccounts } from "#test/repositoryTraits.ts";
import { postgres } from "#test/sqlStory.ts";
import { transaction } from "#test/transaction.ts";

postgres.it(
	"PostgreSQL conflict writes use declared unique keys, generated fields and codec services",
	[hasConflictAccounts()],
	function* ({ sql, makeRepository, conflictAccounts }) {
		yield* Effect.gen(function* () {
			yield* transaction(
				Effect.gen(function* () {
					const { accounts, tableName } = conflictAccounts();
					const input = { amount: 52, email: "one@example.test", externalKey: "one", origin: "import" };
					const original = Option.getOrThrow(yield* accounts.insertOrIgnore(input));
					expect(original).toBeInstanceOf(Account);
					expect(original.createdAt).toBeInstanceOf(Date);
					expect(original.id).toBe(1);
					expect(yield* accounts.insertOrIgnore({ ...input, amount: 99 })).toEqual(Option.none());
					const updated = yield* accounts.upsert({ ...input, amount: 60, origin: "changed" }, { updateColumns: ["amount"] });
					expect(updated).toEqual({ ...original, amount: 60 });
					expect(yield* accounts.findById(original.id)).toEqual(updated);
					expect(yield* sql`select "externalKey", amount from ${sql(tableName)}`).toEqual([{ amount: "60", externalKey: "prefix:one" }]);
					const unique = yield* transaction(accounts.insertOrIgnore({ ...input, externalKey: "two" })).pipe(Effect.flip);
					expect(unique).toMatchObject({ _tag: "SqlError", reason: { _tag: "UniqueViolation" } });
					const upsertUnique = yield* transaction(accounts.upsert({ ...input, externalKey: "two" }, { updateColumns: ["amount"] })).pipe(Effect.flip);
					expect(upsertUnique).toMatchObject({ _tag: "SqlError", reason: { _tag: "UniqueViolation" } });
					const badInput: typeof Account.insert.Type = JSON.parse(
						'{"externalKey":"two","email":"two@example.test","amount":"bad","origin":"import"}',
					);
					expect(yield* accounts.insertOrIgnore(badInput).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
					expect(yield* accounts.upsert(badInput, { updateColumns: ["amount"] }).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
					const invalidColumns: readonly (readonly ["amount", ..."amount"[]])[] = JSON.parse(
						'[[],["missing"],["id"],["externalKey"],["origin"],["note"]]',
					);
					for (const updateColumns of invalidColumns) {
						expect(yield* accounts.upsert(input, { updateColumns }).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
					}
					const conflictColumns: readonly ["externalKey"] = JSON.parse('["missing"]');
					const invalid = yield* makeRepository(Account, { conflictColumns, idColumn: "id", spanPrefix: "Invalid", tableName });
					expect(yield* invalid.insertOrIgnore(input).pipe(Effect.flip)).toMatchObject({ _tag: "SchemaError" });
					expect(yield* accounts.findMany()).toEqual([updated]);
				}),
			);
		}).pipe(Effect.provideService(Prefix, "prefix:"));
	},
);
