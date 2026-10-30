import { Redacted } from "effect";
import { PgBossClientOptionsError, PgBossError, PgBossPayloadError, PgBossQueueOptionsError, PgBossTestingError } from "#error.ts";

function originalOf(original: Redacted.Redacted<unknown>): string {
	const value = Redacted.value(original);
	return value instanceof Error ? value.message : String(value);
}

export function failureOf(error: unknown): string {
	if (error instanceof PgBossError) {
		return `${error.operation}${error.queue === undefined ? "" : ` ${error.queue}`} failed with ${originalOf(error.original)}`;
	}
	if (error instanceof PgBossPayloadError) {
		return `${error.direction} ${error.queue} payload failed with ${originalOf(error.original)}`;
	}
	if (error instanceof PgBossTestingError) {
		return `testing ${error.operation}${error.queue === undefined ? "" : ` ${error.queue}`} failed with ${originalOf(error.original)}`;
	}
	if (error instanceof PgBossClientOptionsError || error instanceof PgBossQueueOptionsError) {
		return error.message;
	}
	return error instanceof Error ? error.message : String(error);
}
