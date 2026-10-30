import { Cause, Effect, Exit, Option, Predicate, Result } from "effect";
import { Migrator } from "effect/sql";
import { isSqlError } from "effect/sql/SqlError";
import { ModelColumnMismatch } from "#assertModelColumns.ts";

function sqlState(error: unknown) {
	return Predicate.hasProperty(error, "code") && typeof error.code === "string" ? error.code : "unknown";
}

export function failureOf(error: unknown): string {
	if (isSqlError(error)) {
		const driver = error.reason.cause instanceof Error ? error.reason.cause.message : "no message";
		const detail = error.reason._tag === "ConnectionError" ? (error.reason.message ?? driver) : driver;
		return `SQLSTATE ${sqlState(error.reason.cause)}: ${detail}`;
	}
	if (error instanceof Migrator.MigrationError) {
		return `${error.kind}: ${error.message}`;
	}
	if (error instanceof ModelColumnMismatch) {
		return `mismatch: ${error.problems.join("; ")}`;
	}
	if (error instanceof Error) {
		return error.message;
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

export function timesOf(count: number) {
	if (count === 0) {
		return "never";
	}
	return count === 1 ? "once" : `${count} times`;
}

export function attempt<A, E, R>(effect: Effect.Effect<A, E, R>) {
	return Effect.map(Effect.exit(effect), outcomeOf);
}
