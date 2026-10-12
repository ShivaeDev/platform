import { Effect, Exit } from "effect";
import type { SqlError } from "effect/unstable/sql/SqlError";
import { transact } from "@shivaedev/effect-sql/transact.ts";

function isTestExit<A, E>(value: Exit.Exit<A, E> | SqlError): value is Exit.Exit<A, E> {
	return Exit.isExit(value);
}

export function withTestTransaction<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.uninterruptibleMask((restore) =>
		transact(Effect.flatMap(Effect.exit(Effect.scoped(restore(effect))), Effect.fail), { onSqlError: (error) => error }).pipe(
			Effect.catchIf(isTestExit, (exit) => exit),
		),
	);
}
