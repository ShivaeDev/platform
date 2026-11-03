import { Effect, type Exit, type Fiber, Queue, type Scope } from "effect";
import { SqlClient } from "effect/sql";
import type { PostgresTestDatabase, PostgresTestServices } from "#server/database.ts";
import { outcomeOf } from "./outcome.ts";

export type Services = PostgresTestServices | PostgresTestDatabase;
export type Command = Effect.Effect<boolean, unknown, Services | Scope.Scope>;

export interface Block {
	readonly commands: Queue.Queue<Command>;
	database: string;
	readonly fiber: Fiber.Fiber<unknown, unknown>;
}

export const currentDatabase = Effect.gen(function* () {
	const sql = yield* SqlClient.SqlClient;
	const [row] = yield* sql<{ name: string }>`select current_database() as name`;
	return row?.name ?? "";
});

export const serve = Effect.fnUntraced(function* (commands: Queue.Queue<Command>) {
	let done = false;
	while (!done) {
		done = yield* Effect.flatten(Queue.take(commands));
	}
});

export function endedBefore(name: string, exit: Exit.Exit<unknown, unknown>) {
	return Effect.die(new Error(`${name} ended before it ran the step: ${outcomeOf(exit)}.`));
}
