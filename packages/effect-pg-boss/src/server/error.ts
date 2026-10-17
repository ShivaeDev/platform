import { Data, Redacted } from "effect";

export type PgBossOperation = "counts" | "enqueue" | "getJob" | "health" | "register" | "retry" | "start" | "stop";

export class PgBossError extends Data.TaggedError("PgBossError")<{
	readonly operation: PgBossOperation;
	readonly queue?: string | undefined;
	readonly original: Redacted.Redacted<unknown>;
}> {}

export class PgBossQueueOptionsError extends Data.TaggedError("PgBossQueueOptionsError")<{
	readonly queue: string;
	readonly options: readonly ("partition" | "policy")[];
}> {
	override get message(): string {
		return `Queue ${this.queue} cannot change options after creation: ${this.options.join(", ")}`;
	}
}

export class PgBossPayloadError extends Data.TaggedError("PgBossPayloadError")<{
	readonly direction: "decode" | "encode";
	readonly queue: string;
	readonly original: Redacted.Redacted<unknown>;
}> {}

export const toPgBossError = (operation: PgBossOperation, error: unknown, queue?: string): PgBossError =>
	new PgBossError({
		operation,
		original: Redacted.make(error),
		queue,
	});
