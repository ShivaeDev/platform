import type { TestContext, TestOptions, Vitest } from "@effect/vitest";
import type { Effect, Layer } from "effect";
import type { AnyDatabase, DatabaseServiceOf } from "../database.js";

export type { AnyDatabase, DatabaseRequirement } from "../database.js";
export type DatabaseService<Database extends AnyDatabase> =
	DatabaseServiceOf<Database>;

export type DatabaseTest<Database extends AnyDatabase, Provided> = <
	A,
	Eff extends Effect.Effect<unknown, unknown, Provided>,
>(
	name: string,
	body: (
		database: DatabaseService<Database>,
		context: TestContext,
	) => Generator<Eff, A, never>,
	options?: number | TestOptions,
) => void;

export interface DatabaseTester<Database extends AnyDatabase, Provided>
	extends DatabaseTest<Database, Provided> {
	readonly skip: DatabaseTest<Database, Provided>;
	readonly skipIf: (condition: unknown) => DatabaseTest<Database, Provided>;
	readonly runIf: (condition: unknown) => DatabaseTest<Database, Provided>;
	readonly only: DatabaseTest<Database, Provided>;
	readonly each: <Item>(
		cases: ReadonlyArray<Item>,
	) => <A, Eff extends Effect.Effect<unknown, unknown, Provided>>(
		name: string,
		body: (
			item: Item,
			database: DatabaseService<Database>,
			context: TestContext,
		) => Generator<Eff, A, never>,
		options?: number | TestOptions,
	) => void;
	readonly fails: DatabaseTest<Database, Provided>;
}

export type DatabaseIt<
	Database extends AnyDatabase,
	Provided,
> = Vitest.Methods & {
	readonly effectDB: DatabaseTester<Database, Provided>;
};

export interface MakeDatabaseItOptions<
	Database extends AnyDatabase,
	Provided,
	LayerError,
> {
	readonly database: Database;
	readonly layer: Layer.Layer<Provided, LayerError>;
}
