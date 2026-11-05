import { Effect } from "effect";
import { PostgresTestDatabase, type PostgresTestTemplate } from "#server/database.ts";

export const isolateDatabase = Effect.fnUntraced(function* <A, E, R>(
	effect: Effect.Effect<A, E, R>,
	options?: { readonly template?: PostgresTestTemplate },
) {
	const database = yield* PostgresTestDatabase;
	const services = yield* options?.template === undefined ? database.isolated : database.clone(options.template);
	return yield* Effect.scoped(effect.pipe(Effect.provideContext(services)));
});
