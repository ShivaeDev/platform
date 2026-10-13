import { Context, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { integration, runDatabase, values } from "#test/postgres.ts";
import { withIsolatedDatabase } from "./withIsolatedDatabase.ts";

class Items extends Context.Service<Items, { readonly rename: (value: string) => Effect.Effect<void, unknown> }>()("@test/Items") {}

const items = Layer.effect(
	Items,
	Effect.map(SqlClient.SqlClient, (sql) => ({ rename: (value: string) => Effect.asVoid(sql`update items set value = ${value}`) })),
);

integration("application Layers built inside isolation acquire the clone's client", async () => {
	await runDatabase(
		Effect.gen(function* () {
			const acquired = yield* Layer.build(items);
			const shared = Context.get(acquired, Items);
			yield* withIsolatedDatabase(
				Effect.gen(function* () {
					yield* shared.rename("shared");
					expect(yield* values).toEqual([{ value: "seed" }]);
					yield* Effect.gen(function* () {
						const service = yield* Items;
						yield* service.rename("isolated");
					}).pipe(Effect.provide(Layer.fresh(items)));
					expect(yield* values).toEqual([{ value: "isolated" }]);
				}),
			);
			expect(yield* values).toEqual([{ value: "shared" }]);
		}),
	);
});
