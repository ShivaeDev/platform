import type { Effect } from "effect";
import type { PrismaError } from "../error.js";
import { getDatabaseTesting } from "../internal/testing.js";
import type { AnyDatabase, DatabaseRequirement } from "./types.js";

type WithTestTransaction = {
	<Database extends AnyDatabase>(
		database: Database,
	): <A, E, R>(
		program: Effect.Effect<A, E, R>,
	) => Effect.Effect<A, E | PrismaError, R | DatabaseRequirement<Database>>;
	<Database extends AnyDatabase, A, E, R>(
		database: Database,
		program: Effect.Effect<A, E, R>,
	): Effect.Effect<A, E | PrismaError, R | DatabaseRequirement<Database>>;
};

export const withTestTransaction: WithTestTransaction = ((
	database: AnyDatabase,
	program?: Effect.Effect<unknown, unknown, unknown>,
) => {
	const run = (effect: Effect.Effect<unknown, unknown, unknown>) =>
		getDatabaseTesting<DatabaseRequirement<typeof database>>(
			database,
		).withTestTransaction(effect);

	return program === undefined ? run : run(program);
}) as WithTestTransaction;
