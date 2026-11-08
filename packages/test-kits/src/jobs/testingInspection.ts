import { Effect } from "effect";
import { PgBossError } from "@shivaedev/jobs/server/error.ts";
import { PgBossTestingError } from "#jobs/error.ts";

export function testingInspection<A, E, R>(operation: string, effect: Effect.Effect<A, E | PgBossError, R>, queue?: string) {
	return effect.pipe(
		Effect.catchIf(
			(error): error is PgBossError => error instanceof PgBossError,
			(error) => Effect.fail(new PgBossTestingError({ operation, original: error.original, queue: queue ?? error.queue })),
		),
	);
}
