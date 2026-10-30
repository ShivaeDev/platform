import { Effect } from "effect";
import type { PgBossService } from "#service.ts";
import type { pgBossRuntime } from "#test/pgBossRuntime.ts";
import type { tracingEngine } from "#test/tracingEngine.ts";

export function tracingVerbs(trace: ReturnType<typeof tracingEngine>, runtime: ReturnType<typeof pgBossRuntime>) {
	return {
		handled: trace.handled,
		producer: () => runtime.boot([trace.queue]).pipe(Effect.withTracer(trace.tracer)),
		queue: trace.queue,
		send: (jobs: PgBossService, payload: { readonly id: number }, linked = false) => {
			const send = jobs.enqueue(trace.queue, payload);
			return (linked ? send.pipe(Effect.withSpan("request")) : send).pipe(Effect.withTracer(trace.tracer));
		},
		spans: trace.spans,
		worker: () =>
			runtime
				.boot([trace.worker(trace.failFirst)])
				.pipe(Effect.withTracer(trace.tracer), Effect.withSpan("worker-startup"), Effect.annotateLogs({ worker: "traced-worker" })),
	};
}
