import { Effect } from "effect";
import { testingEngine } from "@shivaedev/test-kits/jobs/adapters/testingEngine.ts";
import type { DatabaseEngine } from "#test/postgres/databaseEngine.ts";
import { admin } from "#test/postgres/engine.ts";
import { idOf } from "#test/postgres/verbs.ts";

export function engineVerbs(engine: DatabaseEngine, tell: (line: string) => void) {
	return {
		expiryFailure: (as: string) => {
			tell(`ask the engine to expire ${as}`);
			return Effect.gen(function* () {
				const client = yield* admin(engine);
				const { id, queue } = idOf(engine, as);
				return yield* testingEngine(client, "pgboss").expireAttempt({ id, name: queue.name, retryCount: 0 }).pipe(Effect.flip);
			});
		},
	};
}
