import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { Effect } from "effect";

// A WeakRef stays alive until the current job ends, so the collection runs after a macrotask boundary.
export const collectGarbage = Effect.fn("ContractTest.collectGarbage")(function* () {
	yield* Effect.sleep(0);
	setFlagsFromString("--expose_gc");
	Reflect.apply(runInNewContext("gc"), undefined, []);
	yield* Effect.sleep(0);
});
