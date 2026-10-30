import { Redacted } from "effect";
import { PgBossError, PgBossPayloadError, PgBossTestingError } from "#error.ts";

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
	if (error instanceof Error) {
		return error.message;
	}
	return taggedOf(error) ?? String(error);
}

function taggedOf(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) {
		return undefined;
	}
	const tag = Reflect.get(error, "_tag");
	const message = Reflect.get(error, "message");
	if (typeof tag !== "string") {
		return undefined;
	}
	return typeof message === "string" && message !== "" ? `${tag}: ${message}` : tag;
}
