import { Deferred, Effect } from "effect";
import { type Application, orderId } from "./applicationEngine.ts";
import { screenVerbs } from "./screenVerbs.ts";

export function orderVerbs(engine: Application, tell: (line: string) => void) {
	return {
		...screenVerbs(engine, tell),
		changes: () => [...engine.changes],
		forbiddenSave: (alias: string, token?: string) =>
			Effect.gen(function* () {
				tell(`${token ?? "an anonymous caller"} tries to save ${alias}`);
				const client = yield* engine.connect(token);
				return yield* client["orders.save"]({ id: orderId(engine, alias), name: "Forbidden overwrite", quantity: 900 }).pipe(
					Effect.match({ onFailure: (error) => error._tag, onSuccess: () => "saved" as const }),
				);
			}),
		gets: () => new Map(engine.gets),
		orderId: (alias: string) => orderId(engine, alias),
		readAsBob: (alias: string) => {
			tell(`Bob requests ${alias}`);
			return engine.bob["orders.get"]({ id: orderId(engine, alias) }).pipe(
				Effect.match({ onFailure: (error) => error._tag, onSuccess: () => "saved" as const }),
			);
		},
		rejectOrder: (alias: string, quantity: number) => {
			tell(`Alice tries to save ${alias} with quantity ${quantity}`);
			return engine.alice["orders.save"]({ id: orderId(engine, alias), name: "Rejected write", quantity }).pipe(
				Effect.match({
					onFailure: (error) => (error._tag === "OrderValidation" ? { field: error.field, message: error.message } : error._tag),
					onSuccess: () => "saved" as const,
				}),
			);
		},
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
		saveOrder: (alias: string, name: string, quantity: number) => {
			tell(`Alice saves ${alias} as ${name} / ${quantity}`);
			return engine.alice["orders.save"]({ id: orderId(engine, alias), name, quantity });
		},
		storedOrder: (alias: string) => {
			tell(`read stored ${alias}`);
			return engine.sql`select name, quantity from orders where id = ${orderId(engine, alias)}`;
		},
	};
}
