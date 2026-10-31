import { Effect, Schema } from "effect";
import { SqlError } from "effect/sql/SqlError";
import { BadRequest, Conflict, Forbidden, NotFound, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { BoardAcknowledgementStale } from "#board/schema.ts";
import { HostConfigRejected, HostFailure } from "#host/config.ts";
import { BoardFailure } from "#policy.ts";
import { ReportFileFailure } from "#reportFileFailure.ts";
import { SessionFailure } from "#session/schema.ts";
import { StorageAdmission, StorageCapacity, StorageConflict, StorageQuota } from "#storage/errors.ts";

function on<T>(type: abstract new (...args: never[]) => T, phrase: (error: T) => string) {
	return (error: unknown) => (error instanceof type ? phrase(error) : undefined);
}

const phrases = [
	on(Forbidden, ({ message }) => `forbidden: ${message}`),
	on(BadRequest, ({ message }) => `bad request: ${message}`),
	on(Conflict, ({ message }) => `conflict: ${message}`),
	on(NotFound, ({ message }) => `not found: ${message}`),
	on(ServiceUnavailable, ({ message }) => `unavailable: ${message}`),
	on(BoardFailure, ({ message }) => `Board failure: ${message}`),
	on(BoardAcknowledgementStale, ({ message }) => `stale acknowledgement: ${message}`),
	on(HostFailure, ({ message }) => `host failure: ${message}`),
	on(HostConfigRejected, ({ file, message }) => `config rejected in ${file}: ${message}`),
	on(ReportFileFailure, ({ message }) => `report file failure: ${message}`),
	on(SessionFailure, sessionWords),
	on(
		StorageConflict,
		({ actualVersion, expectedVersion, workId }) => `storage conflict on ${workId}: expected ${expectedVersion}, found ${actualVersion}`,
	),
	on(StorageCapacity, ({ kind, limit }) => `${kind} capacity of ${limit} is full`),
	on(StorageQuota, ({ reason }) => `quota ${reason}`),
	on(StorageAdmission, ({ message }) => `admission refused: ${message}`),
	on(Schema.SchemaError, ({ message }) => `invalid stored data: ${message}`),
	on(SqlError, ({ message }) => `database failure: ${message}`),
];

export function described(error: unknown) {
	for (const phrase of phrases) {
		const words = phrase(error);
		if (words !== undefined) {
			return words;
		}
	}
	return `unexpected failure: ${error instanceof Error ? error.message : String(error)}`;
}

export function sessionWords({ capacity, code, message, reason, terminalReceipts }: SessionFailure) {
	const receipts = terminalReceipts === undefined ? "" : `; terminal receipts ${terminalReceipts.map(({ turnId }) => turnId).join(", ")}`;
	return `session ${reason}${code === undefined ? "" : ` (${code})`}${capacity === undefined ? "" : ` at ${capacity}`}: ${message}${receipts}`;
}

export function outcomeOf<A, E, R>(effect: Effect.Effect<A, E, R>, success: (value: A) => string): Effect.Effect<string, never, R> {
	return effect.pipe(Effect.match({ onFailure: described, onSuccess: success }));
}

export function refusal<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<string, never, R> {
	return outcomeOf(effect, () => "accepted");
}
