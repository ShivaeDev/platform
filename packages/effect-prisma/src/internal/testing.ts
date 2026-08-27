import type { Effect } from "effect";
import type { PrismaError } from "../error.js";

export const DatabaseTestingTypeId: unique symbol = Symbol.for(
	"@shivaedev/effect-prisma/DatabaseTesting",
);

export interface DatabaseTesting<DatabaseId> {
	readonly withTestTransaction: <A, E, R>(
		program: Effect.Effect<A, E, R> & (DatabaseId extends R ? unknown : never),
	) => Effect.Effect<A, E | PrismaError, DatabaseId | Exclude<R, DatabaseId>>;
}

export interface DatabaseWithTesting<DatabaseId> {
	readonly [DatabaseTestingTypeId]: DatabaseTesting<DatabaseId>;
}

export const getDatabaseTesting = <DatabaseId>(
	database: object,
): DatabaseTesting<DatabaseId> => {
	const testing = Reflect.get(database, DatabaseTestingTypeId) as
		| DatabaseTesting<DatabaseId>
		| undefined;

	if (testing === undefined) {
		throw new TypeError(
			"The database was not created by this copy of @shivaedev/effect-prisma",
		);
	}

	return testing;
};
