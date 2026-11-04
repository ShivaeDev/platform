import { Effect } from "effect";
import { testingEngine } from "@shivaedev/test-kits/jobs/adapters/testingEngine.ts";
import type { DatabaseEngine } from "./databaseEngine.ts";
import { admin } from "./engine.ts";
import { idOf } from "./verbs.ts";

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
