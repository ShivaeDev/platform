import { Data, Redacted } from "effect";

export type PgBossOperation =
	| "counts"
	| "deadLetteredJobs"
	| "enqueue"
	| "failedJobs"
	| "getJob"
	| "health"
	| "install"
	| "register"
	| "retry"
	| "start"
	| "stop";

export class PgBossError extends Data.TaggedError("PgBossError")<{
	readonly operation: PgBossOperation;
	readonly queue?: string | undefined;
	readonly original: Redacted.Redacted<unknown>;
}> {
	// The original's message can quote payloads or connection strings, so only its class and code are shown.
	override get message(): string {
		const target = this.queue === undefined ? "" : ` for queue ${this.queue}`;
		return `pg-boss ${this.operation}${target} failed: ${originalKind(Redacted.value(this.original))}`;
	}
}

function originalKind(original: unknown): string {
	if (!(original instanceof Error)) {
		return typeof original;
	}
	const code: unknown = Reflect.get(original, "code");
	return typeof code === "string" ? `${original.constructor.name} ${code}` : original.constructor.name;
}

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

export class PgBossTestingError extends Data.TaggedError("PgBossTestingError")<{
	readonly operation: string;
	readonly original: Redacted.Redacted<unknown>;
	readonly queue?: string | undefined;
}> {}

export const toPgBossError = (operation: PgBossOperation, error: unknown, queue?: string): PgBossError =>
	new PgBossError({
		operation,
		original: Redacted.make(error),
		queue,
	});
