import { Effect, Exit } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import { transact } from "@shivaedev/sql/transact.ts";
import { connectionLimitHint } from "#internal/connectionLimitHint.ts";

function isTestExit<A, E>(value: Exit.Exit<A, E> | SqlError): value is Exit.Exit<A, E> {
	return Exit.isExit(value);
}

export function withTestTransaction<A, E, R>(effect: Effect.Effect<A, E, R>) {
	const rollback = Effect.uninterruptibleMask((restore) => Effect.flatMap(Effect.exit(Effect.scoped(restore(effect))), Effect.fail));
	return transact(rollback, { onSqlError: (error) => error }).pipe(
		Effect.catchIf(isTestExit, (exit) => exit),
		Effect.mapError(connectionLimitHint),
	);
}
