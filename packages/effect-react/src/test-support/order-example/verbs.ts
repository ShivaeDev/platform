import { Deferred, Effect, Result } from "effect";
import { expect } from "vitest";
import { type Application, orderId } from "./applicationEngine.ts";
import { screenVerbs } from "./screenVerbs.ts";

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
		forbiddenSave: (alias: string, token: string | undefined, tag: string) =>
			Effect.gen(function* () {
				tell(`${token ?? "an anonymous caller"} cannot save ${alias}`);
				const client = yield* engine.connect(token);
				const result = yield* client["orders.save"]({ id: orderId(engine, alias), name: "Forbidden overwrite", quantity: 900 }).pipe(Effect.result);
				expect(Result.isFailure(result) && result.failure._tag).toBe(tag);
			}),
		getsAre: (counts: Record<string, number>) =>
			Effect.sync(() => {
				tell("only the invalidated order is refetched");
				expect(engine.gets).toEqual(new Map(Object.entries(counts).map(([alias, count]) => [orderId(engine, alias), count])));
			}),
		orderIdIs: (alias: string, id: number) => Effect.sync(() => expect(orderId(engine, alias)).toBe(id)),
		rejectOrder: (alias: string, quantity: number) =>
			Effect.gen(function* () {
				tell(`Alice tries to save ${alias} with quantity ${quantity}`);
				const result = yield* engine.alice["orders.save"]({ id: orderId(engine, alias), name: "Rejected write", quantity }).pipe(Effect.result);
				expect(Result.isFailure(result) && result.failure).toMatchObject({ _tag: "OrderValidation", field: "quantity" });
			}),
		releaseSave: () => {
			tell("the save may finish");
			return Deferred.succeed(engine.saves.released, undefined);
		},
		revokeAlice: () =>
			Effect.sync(() => {
				tell("Alice's session is revoked");
				engine.sessions.delete("alice-session");
			}),
		saveHasEntered: () => {
			tell("the save waits before writing");
			return Deferred.await(engine.saves.entered);
		},
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
