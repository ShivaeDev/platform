import { Effect, Result } from "effect";
import { expect } from "vitest";
import { type Application, orderId } from "./applicationEngine.ts";
import { screenVerbs } from "./screens.ts";

export function orderVerbs(engine: Application, tell: (line: string) => void) {
	return {
		...screenVerbs(engine, tell),
		bobCannotRead: (alias: string) =>
			Effect.gen(function* () {
				tell(`Bob cannot read ${alias}`);
				const result = yield* engine.bob["orders.get"]({ id: orderId(engine, alias) }).pipe(Effect.result);
				expect(Result.isFailure(result) && result.failure).toMatchObject({ _tag: "OrderNotFound" });
			}),
		changesAre: (count: number) => Effect.sync(() => expect(engine.changes).toHaveLength(count)),
		orderIdIs: (alias: string, id: number) => Effect.sync(() => expect(orderId(engine, alias)).toBe(id)),
		rejectOrder: (alias: string, quantity: number) =>
			Effect.gen(function* () {
				tell(`Alice tries to save ${alias} with quantity ${quantity}`);
				const result = yield* engine.alice["orders.save"]({ id: orderId(engine, alias), name: "Rejected write", quantity }).pipe(Effect.result);
				expect(Result.isFailure(result) && result.failure).toMatchObject({ _tag: "OrderValidation", field: "quantity" });
			}),
		saveOrder: (alias: string, name: string, quantity: number) =>
			Effect.gen(function* () {
				tell(`Alice saves ${alias} as ${name} / ${quantity}`);
				yield* engine.alice["orders.save"]({ id: orderId(engine, alias), name, quantity });
			}),
		storedOrderIs: (alias: string, name: string, quantity: number) =>
			Effect.gen(function* () {
				tell(`stored ${alias} is ${name} / ${quantity}`);
				const sql = engine.database.observer;
				const rows = yield* sql`select name, quantity from orders where id = ${orderId(engine, alias)}`;
				engine.observations[alias] = rows;
				expect(rows).toEqual([{ name, quantity }]);
			}),
	};
}
