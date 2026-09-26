import type { Effect } from "effect";
import type { PrismaError } from "../error.ts";
import { getDatabaseTesting } from "../internal/testing.ts";
import type { AnyDatabase } from "./types.ts";

type TestProgram<Database extends AnyDatabase, A, E, R> = Effect.Effect<A, E, R> & (Effect.Services<Database> extends R ? unknown : never);

type TestTransaction<Database extends AnyDatabase, A, E, R> = Effect.Effect<
	A,
	E | PrismaError,
	Effect.Services<Database> | Exclude<R, Effect.Services<Database>>
>;

export function withTestTransaction<Database extends AnyDatabase>(
	database: Database,
): <A, E, R>(program: TestProgram<Database, A, E, R>) => TestTransaction<Database, A, E, R>;
export function withTestTransaction<Database extends AnyDatabase, A, E, R>(
	database: Database,
	program: TestProgram<Database, A, E, R>,
): TestTransaction<Database, A, E, R>;
export function withTestTransaction(database: AnyDatabase, program?: Effect.Effect<unknown, unknown, unknown>): unknown {
	const run = (effect: Effect.Effect<unknown, unknown, unknown>) => getDatabaseTesting<unknown>(database).withTestTransaction(effect);

	return program === undefined ? run : run(program);
}
