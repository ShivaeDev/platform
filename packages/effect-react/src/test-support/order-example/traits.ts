import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { app } from "./application.ts";
import { openScreen } from "./screens.ts";
import { seedOrder } from "./seed.ts";

export function aliceHasOrder(alias: string) {
	return app.trait("orders", `Alice has the order ${alias}`, function* (engine) {
		const order = yield* seedOrder().pipe(Effect.provideService(SqlClient.SqlClient, engine.database.sql));
		engine.orders.set(alias, order);
	});
}
export function orderListIsOpen(alias: string) {
	return app.trait("screen", `Alice opens the list containing ${alias}`, function* (engine) {
		yield* openScreen(engine, alias, "list");
	});
}
export function orderEditorIsOpen(alias: string) {
	return app.trait("screen", `Alice opens the editor for ${alias}`, function* (engine) {
		yield* openScreen(engine, alias, "editor");
	});
}
