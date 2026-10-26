import { Effect, Option, Schema, Tracer } from "effect";
import type { Job } from "pg-boss";

const TracedPayload = Schema.Struct({
	_tag: Schema.Literal("@shivaedev/jobs/TracedPayload"),
	payload: Schema.Unknown,
	span: Schema.Struct({ sampled: Schema.Boolean, spanId: Schema.String, traceId: Schema.String }),
});

const isTracedPayload = Schema.is(TracedPayload);

export function capturePayload(payload: object): Effect.Effect<object> {
	return Effect.map(Effect.option(Effect.currentParentSpan), (span) =>
		Option.isNone(span)
			? payload
			: ({
					_tag: "@shivaedev/jobs/TracedPayload",
					payload,
					span: { sampled: span.value.sampled, spanId: span.value.spanId, traceId: span.value.traceId },
				} satisfies typeof TracedPayload.Type),
	);
}

export function payloadOf(data: unknown): unknown {
	return isTracedPayload(data) ? data.payload : data;
}

export function traceJob<A, E, R>(effect: Effect.Effect<A, E, R>, job: Job<unknown>, queue: string) {
	return Effect.withSpan(effect, queue, {
		attributes: {
			"job.attempt": job.retryCount + 1,
			"job.id": job.id,
			"job.name": job.name,
			"job.queue": queue,
			"job.retry_count": job.retryCount,
			"messaging.destination.name": queue,
			"messaging.message.id": job.id,
			"messaging.system": "pg-boss",
		},
		kind: "consumer",
		links: isTracedPayload(job.data) ? [{ attributes: {}, span: Tracer.externalSpan(job.data.span) }] : [],
		root: true,
	});
}
