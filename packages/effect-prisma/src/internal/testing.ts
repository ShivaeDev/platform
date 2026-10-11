import type { Effect } from "effect";
import type { PrismaError } from "#error.ts";

export const DatabaseTestingTypeId: unique symbol = Symbol.for("@shivaedev/effect-prisma/DatabaseTesting");

export interface DatabaseTesting<TDatabaseId> {
	readonly withTestTransaction: <A, E, R>(
		program: Effect.Effect<A, E, R> & (TDatabaseId extends R ? unknown : never),
	) => Effect.Effect<A, E | PrismaError, TDatabaseId | Exclude<R, TDatabaseId>>;
}

export interface DatabaseWithTesting<TDatabaseId> {
	readonly [DatabaseTestingTypeId]: DatabaseTesting<TDatabaseId>;
}

// makeSqlDatabase installs the testing hooks for the database's own service identifier.
function testingFor<TDatabaseId>(testing: object): DatabaseTesting<TDatabaseId>;
function testingFor(testing: object): unknown {
	return testing;
}

export const getDatabaseTesting = <TDatabaseId>(database: object): DatabaseTesting<TDatabaseId> => {
	const testing: unknown = Reflect.get(database, DatabaseTestingTypeId);

	if (typeof testing !== "object" || testing === null || typeof Reflect.get(testing, "withTestTransaction") !== "function") {
		throw new TypeError("The database was not created by this copy of @shivaedev/effect-prisma");
	}

	return testingFor<TDatabaseId>(testing);
};
