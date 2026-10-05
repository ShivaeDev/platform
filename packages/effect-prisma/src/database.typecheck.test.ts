import type { ExtractFieldOutputTypes } from "@prisma-next/sql-contract/types";
import { Effect, type Layer, type Option } from "effect";
import { expectTypeOf } from "vitest";
import { makeDatabase } from "#database.ts";
import type { DatabaseServiceOf } from "#databaseTypes.ts";
import type { PrismaError } from "#error.ts";
import { type Contract, contractJson } from "#test/contract.ts";
import { AuditDatabase, Database, type User } from "#test/typed-database.ts";
import { makeDatabaseIt } from "#testing/vitest.ts";

type ContractEmail = ExtractFieldOutputTypes<Contract>["public"]["User"]["email"];
expectTypeOf<ContractEmail>().not.toBeAny();
expectTypeOf<ContractEmail>().toEqualTypeOf<string>();

declare const pickForeign: boolean;
declare const databaseService: DatabaseServiceOf<typeof Database>;
declare const auditDatabaseService: DatabaseServiceOf<typeof AuditDatabase>;
// @ts-expect-error Same-contract Database services retain distinct nominal identities.
const mislabeledDatabaseService: DatabaseServiceOf<typeof Database> = auditDatabaseService;
void databaseService;
void mislabeledDatabaseService;

declare const widenedIdentifier: string;
// @ts-expect-error A widened identifier cannot provide a stable Database identity.
makeDatabase<Contract>()(widenedIdentifier, { contractJson });
declare const unionIdentifier: "@test/One" | "@test/Two";
// @ts-expect-error A union identifier cannot name one Database identity.
makeDatabase<Contract>()(unionIdentifier, { contractJson });
declare const patternedIdentifier: `@tenant/${string}`;
// @ts-expect-error A template pattern can name more than one Database identity.
makeDatabase<Contract>()(patternedIdentifier, { contractJson });
declare const brandedIdentifier: string & {
	readonly DatabaseIdentifier: unique symbol;
};
// @ts-expect-error A branded widened string can name more than one Database identity.
makeDatabase<Contract>()(brandedIdentifier, { contractJson });
const reservedIdentifier = "\0@shivaedev/effect-prisma/internal/ActiveTransaction/0";
// @ts-expect-error Internal Context keys cannot also identify a Database.
makeDatabase<Contract>()(reservedIdentifier, { contractJson });
expectTypeOf<Layer.Success<ReturnType<typeof Database.layer>>>().toEqualTypeOf<Effect.Services<typeof Database>>();
const databaseIt = makeDatabaseIt({
	database: Database,
	layer: Database.layer({
		url: "postgresql://compile-only",
	}),
});

databaseIt.effectDB("retains generated model types", function* (db, context) {
	expectTypeOf(db).not.toBeAny();
	expectTypeOf(db.User).not.toBeAny();
	expectTypeOf(context).not.toBeAny();

	const user = yield* db.User.where({ email: "typed@example.test" }).first();
	expectTypeOf(user).toEqualTypeOf<Option.Option<User>>();

	// @ts-expect-error The test facade must reject models absent from the contract.
	db.Movie;
	// @ts-expect-error The test facade must preserve field input types.
	db.User.where({ email: 123 });
});

const program = Effect.gen(function* () {
	const db = yield* Database;

	expectTypeOf(db).not.toBeAny();
	expectTypeOf(db.User).not.toBeAny();

	const allUsers = yield* db.User;
	expectTypeOf(allUsers).not.toBeAny();
	expectTypeOf(allUsers).toEqualTypeOf<User[]>();

	const byObject = db.User.where({ email: "hello@example.com" });
	expectTypeOf(byObject).not.toBeAny();
	expectTypeOf<Effect.Success<typeof byObject>>().not.toBeAny();
	expectTypeOf<Effect.Success<typeof byObject>>().toEqualTypeOf<User[]>();
	expectTypeOf<Effect.Error<typeof byObject>>().toEqualTypeOf<PrismaError>();
	expectTypeOf<Effect.Services<typeof byObject>>().toBeNever();

	const transaction = db.transaction(
		Effect.gen(function* () {
			const transactionDb = yield* Database;
			return yield* transactionDb.User.count();
		}),
	);
	expectTypeOf<Effect.Success<typeof transaction>>().toEqualTypeOf<number>();
	expectTypeOf<Effect.Services<typeof transaction>>().toBeNever();

	const crossDatabaseTransaction = db.transaction(
		Effect.gen(function* () {
			yield* Database;
			const auditDb = yield* AuditDatabase;
			const maybeForeign = pickForeign ? auditDb.Post : db.Post;
			db.User.include(
				"posts",
				// @ts-expect-error Included Relations must come from this Database identity.
				auditDb.Post,
			);
			db.User.include(
				"posts",
				// @ts-expect-error A union cannot hide a Relation from another Database.
				maybeForeign,
			);
			return yield* auditDb.User.count();
		}),
	);
	expectTypeOf<Effect.Services<typeof crossDatabaseTransaction>>().toEqualTypeOf<Effect.Services<typeof AuditDatabase>>();

	const byCallback = db.User.where((user) => {
		expectTypeOf(user).not.toBeAny();
		expectTypeOf(user.email).not.toBeAny();
		return user.email.eq("hello@example.com");
	});
	expectTypeOf(byCallback).not.toBeAny();
	const byTimestamp = db.User.where({ createdAt: new Date(0) });
	expectTypeOf<Effect.Success<typeof byTimestamp>>().toEqualTypeOf<User[]>();
	db.User.where((user) => user.createdAt.gte(new Date(0)));
	db.User.where({ verifiedAt: new Date(0) });

	const deeplyComposed = db.User.where({ name: "Ada" })
		.where((user) => user.email.eq("ada@example.com"))
		.orderBy((user) => user.name.asc())
		.take(25)
		.select("id", "email");

	expectTypeOf(deeplyComposed).not.toBeAny();
	expectTypeOf<Effect.Success<typeof deeplyComposed>>().not.toBeAny();
	expectTypeOf<Effect.Success<typeof deeplyComposed>>().toEqualTypeOf<
		Array<{
			id: string;
			email: string;
		}>
	>();

	const recursivelyComposed = db.User.where({ name: "Ada" })
		.where((user) => user.email.eq("ada@example.com"))
		.orderBy((user) => user.name.asc())
		.where((user) => user.id.eq(crypto.randomUUID()))
		.take(100)
		.where({ email: "ada@example.com" })
		.orderBy((user) => user.email.desc())
		.where((user) => user.name.neq("Grace"))
		.take(50)
		.where({ name: "Ada" })
		.orderBy((user) => user.id.asc())
		.take(25);
	expectTypeOf(recursivelyComposed).not.toBeAny();
	expectTypeOf<Effect.Success<typeof recursivelyComposed>>().toEqualTypeOf<User[]>();

	yield* byObject;
	yield* byCallback;

	const first = yield* byObject.first();
	expectTypeOf(first).not.toBeAny();
	expectTypeOf(first).toEqualTypeOf<Option.Option<User>>();

	const exists = yield* byObject.exists();
	expectTypeOf(exists).not.toBeAny();
	expectTypeOf(exists).toEqualTypeOf<boolean>();

	const count = yield* byObject.count();
	expectTypeOf(count).not.toBeAny();
	expectTypeOf(count).toEqualTypeOf<number>();

	const selected = yield* db.User.select("id", "email");
	expectTypeOf(selected).not.toBeAny();
	expectTypeOf(selected).toEqualTypeOf<
		Array<{
			id: string;
			email: string;
		}>
	>();

	const selectedRow = selected[0];
	if (selectedRow !== undefined) {
		expectTypeOf(selectedRow.id).toEqualTypeOf<string>();
		// @ts-expect-error A selected row must not silently retain omitted fields.
		selectedRow.name;
	}
});

expectTypeOf(program).not.toBeAny();
expectTypeOf<Effect.Success<typeof program>>().toEqualTypeOf<void>();

void program;
