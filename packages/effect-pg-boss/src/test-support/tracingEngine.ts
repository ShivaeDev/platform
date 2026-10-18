import { Effect, Schema } from "effect";
import { defineQueue } from "#definition.ts";
import { recordingTracer } from "#test/recordingTracer.ts";

export function tracingEngine() {
	const trace = recordingTracer();
	const handled: object[] = [];
	const queue = defineQueue({
		name: "tracing",
		queue: { retryBackoff: false, retryDelay: 0, retryLimit: 1 },
		schema: Schema.Struct({ id: Schema.NumberFromString }),
		worker: { pollingIntervalSeconds: 0.5 },
	});
	const stepOne = Effect.fn("Tracing.stepOne")(() => Effect.void);
	const stepTwo = Effect.fn("Tracing.stepTwo")(() => Effect.void);
	return {
		...trace,
		failFirst: false,
		handled,
		queue,
		worker: (failFirst: boolean) =>
			queue.handle((payload) =>
				Effect.gen(function* () {
					handled.push(payload);
					yield* stepOne();
					yield* stepTwo();
					if (failFirst && handled.length === 1) {
						return yield* Effect.fail(new Error("Retry this job"));
					}
				}),
			),
	};
}
