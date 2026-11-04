import { Effect, Redacted } from "effect";
import { PgBossError } from "@shivaedev/jobs/server/error.ts";
import { PgBossTestingError } from "#jobs/error.ts";

export function testingOperation<A>(operation: string, run: () => Promise<A>, queue?: string) {
	return Effect.tryPromise({
		catch: (original) => new PgBossTestingError({ operation, original: Redacted.make(original), queue }),
		try: run,
	});
}

export function testingInspection<A, E, R>(operation: string, effect: Effect.Effect<A, E | PgBossError, R>, queue?: string) {
	return effect.pipe(
		Effect.catchIf(
			(error): error is PgBossError => error instanceof PgBossError,
			(error) => Effect.fail(new PgBossTestingError({ operation, original: error.original, queue: queue ?? error.queue })),
		),
	);
}
