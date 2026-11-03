import { type DateTime, type Duration, Effect, type Tracer } from "effect";
import { testingController } from "#server/adapters/testingController.ts";
import type { JobPayloadSchema, QueueDefinition } from "#server/definition.ts";

export function makePgBossTesting(options: PgBossTestingOptions = {}) {
	return testingController(options);
}

export type SnapshotQueue = Pick<QueueDefinition<string, JobPayloadSchema>, "name" | "schema">;

export interface UnfinishedJob<TQueue extends SnapshotQueue> {
	readonly data: TQueue["schema"]["Type"];
	readonly id: string;
	readonly queue: TQueue["name"];
	readonly startAfter: DateTime.Utc;
	readonly state: "active" | "created" | "deferred" | "failed" | "retry";
}

export interface PgBossTestingWaitOptions {
	readonly within?: Duration.Input;
}

export const testRetryPolicy = Object.freeze({ retryBackoff: false, retryDelay: 0 });

export interface PgBossTestingOptions {
	readonly retryPolicy?: typeof testRetryPolicy;
}

export function linkedWorkerSpans(sender: Pick<Tracer.AnySpan, "spanId" | "traceId">, spans: readonly Tracer.Span[]) {
	return Effect.sync(() =>
		spans.filter(
			(span) =>
				span.kind === "consumer"
				&& span.attributes.get("messaging.system") === "pg-boss"
				&& span.links.some((link) => link.span.spanId === sender.spanId && link.span.traceId === sender.traceId),
		),
	);
}

export type PgBossTesting = ReturnType<typeof makePgBossTesting>;
