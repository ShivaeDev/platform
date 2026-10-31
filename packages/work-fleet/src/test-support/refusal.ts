import { Effect } from "effect";
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
	on(SessionFailure, ({ message, reason }) => `session ${reason}: ${message}`),
	on(
		StorageConflict,
		({ actualVersion, expectedVersion, workId }) => `storage conflict on ${workId}: expected ${expectedVersion}, found ${actualVersion}`,
	),
	on(StorageCapacity, ({ kind, limit }) => `${kind} capacity of ${limit} is full`),
	on(StorageQuota, ({ reason }) => `quota ${reason}`),
	on(StorageAdmission, ({ message }) => `admission refused: ${message}`),
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

export function refusal<A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<string, never, R> {
	return effect.pipe(
		Effect.as("accepted"),
		Effect.catch((error) => Effect.succeed(described(error))),
	);
}
