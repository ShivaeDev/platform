import { Effect, Predicate } from "effect";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";

// The OptimisticConcurrencyError of @shivaedev/sql repositories, known by its tag as catchTag knows it, since this
// browser-safe package reaches no server package.
const STALE_WRITE = "OptimisticConcurrencyError";

export interface StaleWrite {
	readonly _tag: typeof STALE_WRITE;
}

// A versioned write that lost its race means the caller acted on an old read, which the shared Conflict tells every client.
export type Answered<E> = E extends StaleWrite ? Conflict : E;

function staleConflict(cause: unknown) {
	const rejection = new Conflict({ message: "This was changed or deleted since you loaded it. Refresh and try again." });
	Object.defineProperty(rejection, "cause", { configurable: true, enumerable: false, value: cause });
	return Effect.fail(rejection);
}

export function answerStaleWrite(effect: Effect.Effect<unknown, unknown, unknown>) {
	return Effect.catchIf(effect, (error) => Predicate.isTagged(error, STALE_WRITE), staleConflict);
}
