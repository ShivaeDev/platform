import { Effect } from "effect";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import type { OptimisticConcurrencyError } from "@shivaedev/sql/repository.ts";

// Typed as the rejection itself: the module's wire check compares the raised class exactly, and the attached cause would widen it.
export function changed(cause: OptimisticConcurrencyError): Effect.Effect<never, Conflict> {
	return Effect.fail(Object.assign(new Conflict({ message: "This note changed. Refresh and review your draft before trying again." }), { cause }));
}
