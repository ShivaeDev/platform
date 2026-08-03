import { Data, Redacted } from "effect";

export type PgBossOperation =
	| "enqueue"
	| "health"
	| "register"
	| "start"
	| "stop";

export class PgBossError extends Data.TaggedError("PgBossError")<{
	readonly operation: PgBossOperation;
	readonly queue?: string;
	readonly original: Redacted.Redacted<unknown>;
}> {}

export class PgBossPayloadError extends Data.TaggedError("PgBossPayloadError")<{
	readonly direction: "decode" | "encode";
	readonly queue: string;
	readonly original: Redacted.Redacted<unknown>;
}> {}

export const toPgBossError = (
	operation: PgBossOperation,
	error: unknown,
	queue?: string,
): PgBossError =>
	new PgBossError({
		operation,
		queue,
		original: Redacted.make(error),
	});
