import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { app } from "./app.ts";
import type { Application } from "./applicationEngine.ts";
import { openScreen, openScreens } from "./screens.ts";
import { settleOrders } from "./screenVerbs.ts";
import { seedOrder } from "./seed.ts";
import { orderVerbs } from "./verbs.ts";

function quiet() {
	return undefined;
}

function* seeded(engine: Application, alias: string, values?: Parameters<typeof seedOrder>[0]) {
	const order = yield* seedOrder(values).pipe(Effect.provideService(SqlClient.SqlClient, engine.database.sql));
	engine.orders.set(alias, order);
}

function* editorOpen(engine: Application) {
	yield* seeded(engine, "paper");
	yield* openScreen(engine, "paper", "editor");
	yield* settleOrders(engine, quiet);
}

export function aliceHasOrder(alias: string) {
	return app.trait("orders", `Alice has the order ${alias}, Printer paper / 3`, (engine) => seeded(engine, alias));
}

export function hasOrder(alias: string, values: NonNullable<Parameters<typeof seedOrder>[0]>) {
	const described = [values.name ?? "Printer paper", values.quantity ?? 3].join(" / ");
	return app.trait("orders", `${values.ownerId ?? "alice"} has the order ${alias}, ${described}`, (engine) => seeded(engine, alias, values));
}

export function orderListIsOpen(alias: string) {
	return app.trait("screen", `Alice opens the list containing ${alias}`, function* (engine) {
		yield* openScreen(engine, alias, "list");
		yield* settleOrders(engine, quiet);
	});
}

export function orderEditorIsOpen(alias: string) {
	return app.trait("screen", `Alice opens the editor for ${alias}`, function* (engine) {
		yield* openScreen(engine, alias, "editor");
		yield* settleOrders(engine, quiet);
	});
}

export function editorsAreOpen(editors: Record<string, string>, list?: string) {
	return app.trait("screen", `Alice opens ${Object.keys(editors).join(" and ")}${list ? " beside the list" : ""}`, function* (engine) {
		yield* openScreens(engine, editors, list);
		yield* settleOrders(engine, quiet);
	});
}

export function editorIsOpen(key: string, alias: string, token: string | undefined) {
	return app.trait("screen", `${token ?? "an anonymous caller"} opens ${alias}`, function* (engine) {
		yield* openScreens(engine, { [key]: alias }, undefined, token ?? null);
		yield* settleOrders(engine, quiet);
	});
}

export function quantityRejected() {
	return app.trait("screen", "Alice's editor for Printer paper / 3 after the server rejected the quantity -1", function* (engine) {
		yield* editorOpen(engine);
		const { editQuantity, submitOrder } = orderVerbs(engine, quiet);
		yield* editQuantity("-1");
		yield* submitOrder();
	});
}

export function refreshedBesideDirtyEdit() {
	return app.trait("screen", "Alice's editor holding the name Unsubmitted local edit after refreshing to Remote update / 900", function* (engine) {
		yield* editorOpen(engine);
		const { editName, refreshOrder, saveOrder } = orderVerbs(engine, quiet);
		yield* editName("Unsubmitted local edit");
		yield* saveOrder("paper", "Remote update", 900);
		yield* refreshOrder();
	});
}

export function saveHeldWithNewerEdit() {
	return app.trait("screen", "Alice's editor typing Newer local edit while its save of Submitted order waits before writing", function* (engine) {
		engine.saves.held = true;
		yield* editorOpen(engine);
		const { editName, submitOrder } = orderVerbs(engine, quiet);
		yield* editName("Submitted order");
		yield* submitOrder();
		yield* editName("Newer local edit");
	});
}
