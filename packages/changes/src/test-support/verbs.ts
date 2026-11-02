import { Effect } from "effect";
import { batchVerb } from "./batchVerb.ts";
import { type Body, effectOf } from "./body.ts";
import { captureVerbs } from "./captureVerbs.ts";
import { databaseActions } from "./databaseVerbs.ts";
import { driverVerbs } from "./driverVerbs.ts";
import type { Engine } from "./engine.ts";
import { observationVerbs } from "./observationVerbs.ts";
import { orderVerbs } from "./orderVerbs.ts";
import { promiseVerbs } from "./promiseVerbs.ts";

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
