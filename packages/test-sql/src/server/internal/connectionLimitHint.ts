import { Predicate } from "effect";
import { ConnectionError, isSqlError, SqlError } from "effect/sql/SqlError";

export function connectionLimitHint<E>(error: E): E | SqlError {
	if (!(isSqlError(error) && Predicate.hasProperty(error.reason.cause, "code")) || error.reason.cause.code !== "53300") {
		return error;
	}
	return new SqlError({
		reason: new ConnectionError({
			cause: error.reason.cause,
			message:
				"PostgreSQL connection limit reached (SQLSTATE 53300): check max_connections and role connection limits. Try vitest run --maxWorkers=4, reduce the suite's maxConnections, or increase the server's connection budget.",
			operation: error.reason.operation,
		}),
	});
}
