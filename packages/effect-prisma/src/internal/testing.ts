import type { Effect } from "effect";
import type { PrismaError } from "../error.js";

export const DatabaseTestingTypeId: unique symbol = Symbol.for(
	"@shivaedev/effect-prisma/DatabaseTesting",
);

export interface DatabaseTesting<Requirement> {
	readonly withTestTransaction: <A, E, R>(
		program: Effect.Effect<A, E, R>,
	) => Effect.Effect<A, E | PrismaError, R | Requirement>;
}

export interface DatabaseWithTesting<Requirement> {
	readonly [DatabaseTestingTypeId]: DatabaseTesting<Requirement>;
}

export const getDatabaseTesting = <Requirement>(
	database: object,
): DatabaseTesting<Requirement> => {
	const testing = Reflect.get(database, DatabaseTestingTypeId) as
		| DatabaseTesting<Requirement>
		| undefined;

	if (testing === undefined) {
		throw new TypeError(
			"The database was not created by this copy of @shivaedev/effect-prisma",
		);
	}

	return testing;
};
