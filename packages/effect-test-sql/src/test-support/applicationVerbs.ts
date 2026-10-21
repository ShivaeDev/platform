import { Context, Effect, Layer } from "effect";
import { SqlClient } from "effect/sql";

class Items extends Context.Service<Items, { readonly rename: (value: string) => Effect.Effect<void, unknown> }>()("@test/Items") {}
const items = Layer.effect(
	Items,
	Effect.map(SqlClient.SqlClient, (sql) => ({ rename: (value: string) => Effect.asVoid(sql`update items set value = ${value}`) })),
);
export function applicationVerbs() {
	return {
		buildItems: () => Effect.map(Layer.build(items), (context) => Context.get(context, Items)),
		renameThroughFreshLayer: (value: string) => Effect.flatMap(Items, (service) => service.rename(value)).pipe(Effect.provide(Layer.fresh(items))),
	};
}
