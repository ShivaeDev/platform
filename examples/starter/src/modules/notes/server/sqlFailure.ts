import { Match } from "effect";
import type { SqlError } from "effect/sql/SqlError";
import { Conflict, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";

export function notesSqlFailure(cause: SqlError) {
	return Match.value(cause.reason).pipe(
		Match.tag("ConnectionError", () => Object.assign(new ServiceUnavailable({ message: "Could not reach the notes database" }), { cause })),
		Match.tag("ConstraintError", "UniqueViolation", () =>
			Object.assign(new Conflict({ message: "The note violates a database constraint" }), { cause }),
		),
		Match.orElse(() => cause),
	);
}
