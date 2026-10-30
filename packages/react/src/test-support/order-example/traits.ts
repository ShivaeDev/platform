import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { app } from "./app.ts";
import { openScreen, openScreens } from "./screens.ts";
import { seedOrder } from "./seed.ts";

export function aliceHasOrder(alias: string) {
	return app.trait("orders", `Alice has the order ${alias}`, function* (engine) {
		const order = yield* seedOrder().pipe(Effect.provideService(SqlClient.SqlClient, engine.sql));
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

export function hasOrder(alias: string, values: Parameters<typeof seedOrder>[0]) {
	return app.trait("orders", `the order ${alias} exists`, function* (engine) {
		const order = yield* seedOrder(values).pipe(Effect.provideService(SqlClient.SqlClient, engine.sql));
		engine.orders.set(alias, order);
	});
}
export function saveIsHeld() {
	return app.trait("orders", "saves wait before writing", (engine) => {
		engine.saves.held = true;
	});
}
export function editorsAreOpen(editors: Record<string, string>, list?: string) {
	return app.trait("screen", `Alice opens ${Object.keys(editors).join(" and ")}${list ? " beside the list" : ""}`, function* (engine) {
		yield* openScreens(engine, editors, list);
	});
}
export function editorIsOpen(key: string, alias: string, token: string | undefined) {
	return app.trait("screen", `${token || "an anonymous caller"} opens ${alias}`, function* (engine) {
		yield* openScreens(engine, { [key]: alias }, undefined, token ?? null);
	});
}
