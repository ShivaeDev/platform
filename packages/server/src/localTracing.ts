import { Clock, Effect, Layer, Tracer } from "effect";
import { localTraceDatabase } from "#adapters/localTraceDatabase.ts";
import { redactingDiagnostics } from "#adapters/redactingDiagnostics.ts";
import { traceDiagnostics } from "#adapters/traceDiagnostics.ts";
import { type LocalTraceEvent, type LocalTraceRow, localTraceRow } from "#localTraceRow.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";

export interface LocalTracingOptions {
	readonly clock?: Clock.Clock;
	readonly flushInterval?: number;
	readonly indexedAttributes?: readonly string[];
	readonly path?: string;
	readonly retainedRuns?: number;
}

export function localTracing({
	clock = Clock.Clock.defaultValue(),
	path = ".platform/traces.db",
	indexedAttributes = [],
	retainedRuns = 5,
	flushInterval = 1000,
}: LocalTracingOptions = {}) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const policy = yield* RedactionPolicy;
			const underlying = yield* Tracer.Tracer;
			const startedAtMillis = yield* Clock.currentTimeMillis;
			const database = yield* Effect.acquireRelease(
				Effect.try(() => localTraceDatabase(path, retainedRuns, indexedAttributes, startedAtMillis)),
				(db) => Effect.sync(() => db.close()),
			);
			let pending: LocalTraceRow[] = [];
			const flush = Effect.sync(() => {
				database.write(pending);
				pending = [];
			});
			yield* Effect.addFinalizer(() => flush);
			yield* Effect.sleep(flushInterval).pipe(Effect.andThen(flush), Effect.forever, Effect.provideService(Clock.Clock, clock), Effect.forkScoped);
			const tracer = Tracer.make({
				...underlying,
				span: (options) => {
					const span = underlying.span(options);
					const events: LocalTraceEvent[] = [];
					const event = span.event.bind(span);
					const end = span.end.bind(span);
					span.event = (name, time, attributes) => {
						events.push([name, time, attributes ?? {}]);
						event(name, time, attributes);
					};
					span.end = (time, exit) => {
						end(time, exit);
						const row = localTraceRow(span, events, policy);
						if (row !== undefined) {
							pending.push(row);
						}
					};
					return span;
				},
			});
			return redactingDiagnostics(policy).pipe(Layer.provideMerge(traceDiagnostics), Layer.provideMerge(Layer.succeed(Tracer.Tracer, tracer)));
		}),
	);
}
