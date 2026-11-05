import { Effect } from "effect";
import { Conflict } from "@shivaedev/errors/taxonomy.ts";
import type { OptimisticConcurrencyError } from "@shivaedev/sql/repository.ts";

export function changed(cause: OptimisticConcurrencyError) {
	return Effect.fail(Object.assign(new Conflict({ message: "This note changed. Refresh and review your draft before trying again." }), { cause }));
}
