import { Effect } from "effect";
import { linkedWorkerSpans } from "@shivaedev/test-kits/jobs/testing.ts";
import type { DatabaseEngine } from "#test/jobs/postgres/databaseEngine.ts";
import { labelOf } from "#test/jobs/postgres/engine.ts";
import { idOf } from "#test/jobs/postgres/verbs.ts";

export function traceReadouts(engine: DatabaseEngine) {
	return {
		linkedWorkers: (senderName: string) =>
			Effect.gen(function* () {
				const sender = engine.trace.spans.find(({ name }) => name === senderName);
				if (sender === undefined) {
					throw new Error(`No recorded sender span named ${senderName}`);
				}
				const workers = yield* linkedWorkerSpans(sender, engine.trace.spans);
				return workers.map((span) => ({
					attempt: span.attributes.get("job.attempt"),
					job: labelOf(engine, String(span.attributes.get("job.id"))),
					name: span.name,
					trace: span.traceId === sender.traceId ? "sender trace" : "own trace",
				}));
			}),
		workerSenders: (as: string) =>
			Effect.gen(function* () {
				const { id } = idOf(engine, as);
				const senders = yield* Effect.forEach(engine.trace.spans, (sender) =>
					Effect.map(linkedWorkerSpans(sender, engine.trace.spans), (workers) =>
						workers.some((span) => span.attributes.get("job.id") === id) ? [sender.name] : [],
					),
				);
				return senders.flat();
			}),
	};
}
