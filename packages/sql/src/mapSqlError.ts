import type { SqlError } from "effect/sql/SqlError";

export function mapSqlError<TConstraints extends Readonly<Record<string, (error: SqlError) => unknown>>, TFallback>(options: {
	readonly constraints: TConstraints;
	readonly fallback: (error: SqlError) => TFallback;
}): (error: SqlError) => ReturnType<TConstraints[keyof TConstraints]> | TFallback;
export function mapSqlError(options: {
	readonly constraints: Readonly<Record<string, (error: SqlError) => unknown>>;
	readonly fallback: (error: SqlError) => unknown;
}) {
	return (error: SqlError) => {
		const reason = error.reason;
		let constraint: string | undefined;
		if (reason._tag === "UniqueViolation") {
			constraint = reason.constraint;
		} else if (
			reason._tag === "ConstraintError"
			&& typeof reason.cause === "object"
			&& reason.cause !== null
			&& "code" in reason.cause
			&& (reason.cause.code === "23503" || reason.cause.code === "23514")
			&& "constraint" in reason.cause
			&& typeof reason.cause.constraint === "string"
		) {
			constraint = reason.cause.constraint;
		}
		return constraint !== undefined && Object.hasOwn(options.constraints, constraint)
			? (options.constraints[constraint] ?? options.fallback)(error)
			: options.fallback(error);
	};
}
