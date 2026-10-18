import type { Effect } from "effect";
import { transact } from "#transact.ts";

export function transaction<A, E, R>(body: Effect.Effect<A, E, R>) {
	return transact(body, { onSqlError: (error) => error });
}
