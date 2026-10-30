import { Cause, Effect, Exit, Option, Predicate, Result, Schema } from "effect";
import { Migrator } from "effect/sql";
import { isSqlError, type SqlError } from "effect/sql/SqlError";
import { OptimisticConcurrencyError } from "#repository.ts";

const SQL_REASONS: Readonly<Record<string, string>> = {
	AuthenticationError: "an authentication failure",
	AuthorizationError: "an authorization failure",
	ConnectionError: "a connection failure",
	ConstraintError: "a constraint violation",
	DeadlockError: "a deadlock",
	LockTimeoutError: "a lock timeout",
	SerializationError: "a serialization conflict",
	SqlSyntaxError: "a SQL syntax error",
	StatementTimeoutError: "a statement timeout",
	UniqueViolation: "a unique violation",
	UnknownError: "an unclassified SQL failure",
};

const MIGRATION_KINDS: Readonly<Record<Migrator.MigrationError["kind"], string>> = {
	BadState: "a bad migration state",
	Duplicates: "duplicate migrations",
	Failed: "a failed migration",
	ImportError: "a migration import failure",
	Locked: "a locked migration ledger",
};

function sqlState(cause: unknown) {
	return Predicate.hasProperty(cause, "code") && typeof cause.code === "string" && /^[0-9A-Z]{5}$/u.test(cause.code)
		? ` (SQLSTATE ${cause.code})`
		: "";
}

function words(tag: string) {
	return tag.replaceAll(/(?<=[a-z])(?=[A-Z])/gu, " ").toLowerCase();
}

export function sqlReasonOf(error: SqlError): string {
	return SQL_REASONS[error.reason._tag] ?? words(error.reason._tag);
}

export function failureOf(error: unknown): string {
	if (isSqlError(error)) {
		return `${sqlReasonOf(error)}${sqlState(error.reason.cause)}`;
	}
	if (Schema.isSchemaError(error)) {
		return "a schema error";
	}
	if (error instanceof Migrator.MigrationError) {
		return `${MIGRATION_KINDS[error.kind]}: ${error.message}`;
	}
	if (error instanceof OptimisticConcurrencyError) {
		return `a ${error.reason} version conflict for ${JSON.stringify(error.id)} at version ${error.expectedVersion}`;
	}
	if (error instanceof Cause.NoSuchElementError) {
		return "no such row";
	}
	if (error instanceof Error && error.message !== "") {
		return error.message;
	}
	if (Predicate.hasProperty(error, "_tag") && typeof error._tag === "string") {
		return words(error._tag);
	}
	return String(error);
}

export function outcomeOf(exit: Exit.Exit<unknown, unknown>): string {
	if (Exit.isSuccess(exit)) {
		return "succeeded";
	}
	const failure = Cause.findErrorOption(exit.cause);
	if (Option.isSome(failure)) {
		return `failed with ${failureOf(failure.value)}`;
	}
	const defect = Cause.findDefect(exit.cause);
	if (Result.isSuccess(defect)) {
		return `died with ${failureOf(defect.success)}`;
	}
	return Cause.hasInterrupts(exit.cause) ? "interrupted" : "ended without a reason";
}

export function attempt<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A | string, never, R> {
	return Effect.map(Effect.exit(effect), (exit) => (Exit.isSuccess(exit) ? exit.value : outcomeOf(exit)));
}

export function endingOf<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<string, never, R> {
	return Effect.map(Effect.exit(effect), outcomeOf);
}
