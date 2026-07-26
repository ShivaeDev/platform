import type { ExtractFieldOutputTypes } from "@prisma-next/sql-contract/types";
import { Effect, type Option, type Stream } from "effect";
import { expectTypeOf } from "vitest";
import { makeDatabase, type PrismaError } from "../src/index.js";
import { type Contract, contractJson } from "./contract.js";

type User = {
	id: string;
	email: string;
	name: string;
};

type ContractEmail =
	ExtractFieldOutputTypes<Contract>["public"]["User"]["email"];
expectTypeOf<ContractEmail>().toEqualTypeOf<string>();
type IsAny<Value> = 0 extends 1 & Value ? true : false;
type Assert<Condition extends true> = Condition;
type _ContractEmailIsNotAny = Assert<
	IsAny<ContractEmail> extends false ? true : false
>;
type _ContractEmailIsString = Assert<
	ContractEmail extends string ? true : false
>;

const Database = makeDatabase<Contract>("@test/Database", { contractJson });

const program = Effect.gen(function* () {
	const db = yield* Database;

	expectTypeOf(db).not.toBeAny();
	expectTypeOf(db.User).not.toBeAny();

	const allUsers = yield* db.User;
	expectTypeOf(allUsers).not.toBeAny();
	expectTypeOf(allUsers).toEqualTypeOf<Array<User>>();

	const byObject = db.User.where({ email: "hello@example.com" });
	expectTypeOf(byObject).not.toBeAny();
	expectTypeOf<Effect.Success<typeof byObject>>().not.toBeAny();
	expectTypeOf<Effect.Success<typeof byObject>>().toEqualTypeOf<Array<User>>();
	expectTypeOf<Effect.Error<typeof byObject>>().toEqualTypeOf<PrismaError>();
	expectTypeOf<Effect.Services<typeof byObject>>().not.toBeAny();
	expectTypeOf<Effect.Services<typeof byObject>>().not.toBeNever();

	const byCallback = db.User.where((user) => {
		expectTypeOf(user).not.toBeAny();
		expectTypeOf(user.email).not.toBeAny();
		return user.email.eq("hello@example.com");
	});
	expectTypeOf(byCallback).not.toBeAny();

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
	expectTypeOf<Effect.Success<typeof recursivelyComposed>>().toEqualTypeOf<
		Array<User>
	>();

	yield* byObject;
	yield* byCallback;

	const first = yield* byObject.first();
	expectTypeOf(first).not.toBeAny();
	expectTypeOf(first).toEqualTypeOf<Option.Option<User>>();

	const exists = yield* byObject.exists();
	expectTypeOf(exists).not.toBeAny();
	expectTypeOf(exists).toEqualTypeOf<boolean>();

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

	const create = db.User.create({
		id: crypto.randomUUID(),
		email: "new@example.com",
		name: "New user",
	});
	expectTypeOf(create).not.toBeAny();
	expectTypeOf<Effect.Success<typeof create>>().toEqualTypeOf<User>();
	expectTypeOf<Effect.Error<typeof create>>().toEqualTypeOf<PrismaError>();

	expectTypeOf(db.User.stream).not.toBeAny();
	expectTypeOf<Stream.Success<typeof db.User.stream>>().toEqualTypeOf<User>();
	expectTypeOf<
		Stream.Error<typeof db.User.stream>
	>().toEqualTypeOf<PrismaError>();
	expectTypeOf<Stream.Services<typeof db.User.stream>>().not.toBeAny();

	// @ts-expect-error Models are generated from the contract.
	db.Movie;
	// @ts-expect-error Unknown fields must not be accepted by object filters.
	db.User.where({ missing: true });
	// @ts-expect-error Filter values retain their database field types.
	db.User.where({ email: 123 });
	// @ts-expect-error Callback accessors retain their database field types.
	db.User.where((user) => user.email.eq(123));
	// @ts-expect-error Selections are constrained to actual model fields.
	db.User.select("missing");
	// @ts-expect-error The inferred contract requires an id during creation.
	db.User.create({ email: "missing-id@example.com", name: "Missing id" });
	// @ts-expect-error Unsafe whole-collection updates are rejected by Prisma state typing.
	db.User.update({ name: "Unsafe" });
});

expectTypeOf(program).not.toBeAny();
expectTypeOf<Effect.Success<typeof program>>().toEqualTypeOf<void>();

void program;
