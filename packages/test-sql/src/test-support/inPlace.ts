import { Effect, type Scope } from "effect";
import { withIsolatedDatabase } from "#server/withIsolatedDatabase.ts";
import type { Services } from "#test/databaseBlocks.ts";
import type { DatabaseEngine } from "#test/databaseEngine.ts";

export function inPlace<A, E>(engine: DatabaseEngine, place: string, effect: Effect.Effect<A, E, Services | Scope.Scope>) {
	if (place === "the shared database") {
		return engine.run(Effect.scoped(effect));
	}
	if (place === "a new clone") {
		return engine.run(withIsolatedDatabase(effect));
	}
	return engine.inBlock(place, effect);
}
