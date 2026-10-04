import type { Effect } from "effect";
import type { PrismaError } from "#error.ts";

export const DatabaseTestingTypeId: unique symbol = Symbol.for("@shivaedev/effect-prisma/DatabaseTesting");

export interface DatabaseTesting<DatabaseId> {
	readonly withTestTransaction: <A, E, R>(
		program: Effect.Effect<A, E, R> & (DatabaseId extends R ? unknown : never),
	) => Effect.Effect<A, E | PrismaError, DatabaseId | Exclude<R, DatabaseId>>;
}

export interface DatabaseWithTesting<DatabaseId> {
	readonly [DatabaseTestingTypeId]: DatabaseTesting<DatabaseId>;
}

// makeSqlDatabase installs the testing hooks for the database's own service identifier.
function testingFor<DatabaseId>(testing: object): DatabaseTesting<DatabaseId>;
function testingFor(testing: object): unknown {
	return testing;
}

export const getDatabaseTesting = <DatabaseId>(database: object): DatabaseTesting<DatabaseId> => {
	const testing: unknown = Reflect.get(database, DatabaseTestingTypeId);

	if (typeof testing !== "object" || testing === null || typeof Reflect.get(testing, "withTestTransaction") !== "function") {
		throw new TypeError("The database was not created by this copy of @shivaedev/effect-prisma");
	}

	return testingFor<DatabaseId>(testing);
};
