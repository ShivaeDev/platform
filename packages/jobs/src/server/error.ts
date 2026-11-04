import { Cause, Data, Redacted } from "effect";
import { failureOutput } from "#server/internal/failureOutput.ts";

export type PgBossOperation =
	| "counts"
	| "deadLetteredJobs"
	| "deleteQueue"
	| "enqueue"
	| "failedJobs"
	| "getJob"
	| "health"
	| "install"
	| "inspect"
	| "register"
	| "refreshQueueStats"
	| "retry"
	| "settle"
	| "start"
	| "stop"
	| "unschedule";

export class PgBossNotFoundError extends Data.TaggedError("PgBossNotFoundError")<{
	readonly operation: "deleteQueue" | "unschedule";
	readonly queue: string;
	readonly key?: string;
}> {
	override get message(): string {
		return this.operation === "deleteQueue"
			? `Queue ${this.queue} does not exist`
			: `Schedule ${this.queue} with key ${JSON.stringify(this.key ?? "")} does not exist`;
	}
}

export class PgBossError extends Data.TaggedError("PgBossError")<{
	readonly operation: PgBossOperation;
	readonly queue?: string | undefined;
	readonly original: Redacted.Redacted<unknown>;
}> {
	// Non-settlement originals can quote payloads or connection strings, so only their class and code are shown.
	override get message(): string {
		const target = this.queue === undefined ? "" : ` for queue ${this.queue}`;
		const original = Redacted.value(this.original);
		const detail = this.operation === "settle" ? failureOutput(Cause.fail(original)) : undefined;
		return `pg-boss ${this.operation}${target} failed: ${detail === undefined ? originalKind(original) : `${detail._tag}: ${detail.message}`}`;
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

export class PgBossQueueNamesError extends Data.TaggedError("PgBossQueueNamesError")<{
	readonly missing: readonly string[];
	readonly unexpected: readonly string[];
}> {
	override get message(): string {
		return `Queue names differ from their declaration: missing [${this.missing.join(", ")}], unexpected [${this.unexpected.join(", ")}]`;
	}
}

export class PgBossClientOptionsError extends Data.TaggedError("PgBossClientOptionsError")<{
	readonly key: string | symbol;
	readonly options: readonly string[];
}> {
	override get message(): string {
		return `Shared pg-boss client ${String(this.key)} has different constructor settings: ${this.options.join(", ")}`;
	}
}

export class PgBossPayloadError extends Data.TaggedError("PgBossPayloadError")<{
	readonly direction: "decode" | "encode";
	readonly queue: string;
	readonly original: Redacted.Redacted<unknown>;
}> {}

export function toPgBossError(operation: PgBossOperation, error: unknown, queue?: string): PgBossError {
	return new PgBossError({
		operation,
		original: Redacted.make(error),
		queue,
	});
}
