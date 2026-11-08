import { Effect, Redacted } from "effect";
import { PgBossTestingError } from "#jobs/error.ts";

export function testingOperation<A>(operation: string, run: () => Promise<A>, queue?: string) {
	return Effect.tryPromise({
		catch: (original) => new PgBossTestingError({ operation, original: Redacted.make(original), queue }),
		try: run,
	});
}
