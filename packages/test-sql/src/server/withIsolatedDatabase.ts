import { Effect } from "effect";
import { connectionLimitHint } from "#internal/connectionLimitHint.ts";
import { PostgresTestDatabase, type PostgresTestTemplate } from "./database.ts";

export function withIsolatedDatabase<A, E, R>(effect: Effect.Effect<A, E, R>, options?: { readonly template?: PostgresTestTemplate }) {
	return Effect.scoped(
		Effect.gen(function* () {
			const database = yield* PostgresTestDatabase;
			const services = yield* options?.template === undefined ? database.isolated : database.clone(options.template);
			return yield* Effect.scoped(effect.pipe(Effect.provideContext(services)));
		}),
	).pipe(Effect.mapError(connectionLimitHint));
}
