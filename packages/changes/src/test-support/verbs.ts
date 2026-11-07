import { Effect } from "effect";
import { batchVerb } from "#test/batchVerb.ts";
import { type Body, effectOf } from "#test/body.ts";
import { captureVerbs } from "#test/captureVerbs.ts";
import { databaseActions } from "#test/databaseActions.ts";
import { driverVerbs } from "#test/driverVerbs.ts";
import type { Engine } from "#test/engine.ts";
import { observationVerbs } from "#test/observationVerbs.ts";
import { orderVerbs } from "#test/orderVerbs.ts";
import { promiseVerbs } from "#test/promiseVerbs.ts";

export type Place = "outside any transaction" | "in a transaction" | "in a batch" | "in a driver's transaction";

export function verbs(engine: Engine, tell: (line: string) => void) {
	const { database } = databaseActions(engine, tell);
	const main = database("main");
	const drivers = driverVerbs(engine, tell);
	const batch = batchVerb(engine, tell);
	function inPlace<A, E, R>(place: Place, body: Body<A, E, R>) {
		switch (place) {
			case "outside any transaction":
				return Effect.asVoid(effectOf(body));
			case "in a transaction":
				return main.inTransaction(body);
			case "in a batch":
				return batch(body);
			case "in a driver's transaction":
				return Effect.gen(function* () {
					const driven = yield* drivers.driverOpens();
					yield* driven.run(body);
					yield* driven.runHook();
					yield* driven.commit();
				});
		}
	}

	return {
		...main,
		...captureVerbs(engine, tell),
		...drivers,
		...orderVerbs(engine, tell),
		...promiseVerbs(engine, tell),
		...observationVerbs(engine),
		batch,
		database,
		inPlace,
	};
}
