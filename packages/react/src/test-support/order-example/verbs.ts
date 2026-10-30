import { Deferred, Effect, Result } from "effect";
import { type Application, orderId } from "./applicationEngine.ts";
import { screenVerbs, settleOrders } from "./screenVerbs.ts";

export function outcomeOf<A, E>(effect: Effect.Effect<A, E>) {
	return effect.pipe(
		Effect.result,
		Effect.map((result) => {
			if (Result.isSuccess(result)) {
				return "succeeded";
			}
			const failure: unknown = result.failure;
			const tag = typeof failure === "object" && failure !== null && "_tag" in failure ? String(failure._tag) : String(failure);
			const field = typeof failure === "object" && failure !== null && "field" in failure ? ` on ${String(failure.field)}` : "";
			return `rejected as ${tag}${field}`;
		}),
	);
}

export function orderVerbs(engine: Application, tell: (line: string) => void) {
	function answered(call: Effect.Effect<string>) {
		return Effect.map(call, (answer) => {
			engine.answers.push(answer);
		});
	}
	return {
		...screenVerbs(engine, tell),
		answers: () => Effect.sync(() => [...engine.answers]),
		changes: () => Effect.sync(() => [...engine.changes]),
		forbiddenSave: (alias: string, token?: string) =>
			Effect.gen(function* () {
				tell(`${token ?? "an anonymous caller"} tries to save ${alias}`);
				const client = yield* engine.connect(token);
				yield* answered(outcomeOf(client["orders.save"]({ id: orderId(engine, alias), name: "Forbidden overwrite", quantity: 900 })));
			}),
		readAsBob: (alias: string) => {
			tell(`Bob requests ${alias}`);
			return answered(outcomeOf(engine.bob["orders.get"]({ id: orderId(engine, alias) })));
		},
		readsPerOrder: () => Effect.sync(() => Object.fromEntries([...engine.orders].map(([alias, order]) => [alias, engine.gets.get(order.id) ?? 0]))),
		rejectOrder: (alias: string, quantity: number) => {
			tell(`Alice tries to save ${alias} with quantity ${quantity}`);
			return answered(outcomeOf(engine.alice["orders.save"]({ id: orderId(engine, alias), name: "Rejected write", quantity })));
		},
		releaseSave: () =>
			Effect.gen(function* () {
				tell("the held save may finish");
				engine.saves.holding = false;
				yield* Deferred.succeed(engine.saves.released, undefined);
				yield* settleOrders(engine, tell);
			}),
		revokeAlice: () =>
			Effect.sync(() => {
				tell("Alice's session is revoked");
				engine.sessions.delete("alice-session");
			}),
		saveOrder: (alias: string, name: string, quantity: number) => {
			tell(`Alice saves ${alias} as ${name} / ${quantity} through the HTTP API`);
			return engine.alice["orders.save"]({ id: orderId(engine, alias), name, quantity }).pipe(Effect.asVoid);
		},
		storedOrder: (alias: string) =>
			Effect.gen(function* () {
				const [row] = yield* engine.database.observer<{
					readonly name: string;
					readonly quantity: number;
				}>`select name, quantity from orders where id = ${orderId(engine, alias)}`;
				return row ? `${row.name} / ${row.quantity}` : "missing";
			}),
		storedOrders: () => engine.database.observer`select id, name, quantity from orders order by id`,
	};
}
