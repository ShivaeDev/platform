import { Effect } from "effect";
import { PostgresTestDatabase } from "./database.ts";

export function withIsolatedDatabase<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.scoped(
		Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			const services = yield* database.isolated;
			return yield* effect.pipe(Effect.provideContext(services));
		}),
	);
}
