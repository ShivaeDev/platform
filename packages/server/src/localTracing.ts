import { Clock, Effect, Layer, Schedule, Tracer } from "effect";
import { defaultTraceStore } from "#adapters/defaultTraceStore.ts";
import { localTraceDatabase, TraceStoreBusy } from "#adapters/localTraceDatabase.ts";
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

// Untraced: the recorder is still being built, so a span here would reach the application's own tracer as one of its spans.
const storePath = Effect.fnUntraced(function* (chosen: string | undefined) {
	if (chosen !== undefined) {
		return chosen;
	}
	const store = yield* defaultTraceStore;
	if (store.temporary) {
		const refused = store.refused === undefined ? "" : ` and ${store.refused} is not a folder that only this user can reach`;
		yield* Effect.logInfo(
			`Development traces are recorded to ${store.path}, because ${store.workingDirectory} has no node_modules folder${refused}.`,
		);
	}
	return store.path;
});

const busyStoreWait = Schedule.exponential("10 millis").pipe(Schedule.upTo({ duration: "1 second" }));

function whileBusy<A, E>(effect: Effect.Effect<A, E>, clock: Clock.Clock) {
	return effect.pipe(
		Effect.retry({ schedule: busyStoreWait, while: (error) => error instanceof TraceStoreBusy }),
		Effect.provideService(Clock.Clock, clock),
	);
}

export function localTracing({
	clock = Clock.Clock.defaultValue(),
	path: chosen,
	indexedAttributes = [],
	retainedRuns = 5,
	flushInterval = 1000,
}: LocalTracingOptions = {}) {
	return Layer.unwrap(
		Effect.gen(function* () {
			const policy = yield* RedactionPolicy;
			const underlying = yield* Tracer.Tracer;
			const startedAtMillis = yield* Clock.currentTimeMillis;
			const path = yield* storePath(chosen);
			const database = yield* Effect.acquireRelease(
				whileBusy(localTraceDatabase(path, retainedRuns, indexedAttributes, startedAtMillis), clock),
				(db) => db.close,
			);
			let pending: LocalTraceRow[] = [];
			let dropping = false;
			const written = Effect.sync(() => {
				dropping = false;
			});
			function dropped(spans: number) {
				if (dropping) {
					return Effect.void;
				}
				dropping = true;
				return Effect.logWarning(
					`Development traces were dropped: another writer held ${path} for over a second, so ${spans} spans were not recorded. Later drops are not logged until a write succeeds.`,
				);
			}
			function flush(write: (rows: readonly LocalTraceRow[]) => Effect.Effect<void, TraceStoreBusy>) {
				return Effect.suspend(() => {
					const rows = pending;
					pending = [];
					return whileBusy(write(rows), clock).pipe(Effect.matchEffect({ onFailure: () => dropped(rows.length), onSuccess: () => written }));
				});
			}
			yield* Effect.addFinalizer(() => flush(database.finish));
			yield* Effect.sleep(flushInterval).pipe(
				Effect.andThen(Effect.suspend(() => (pending.length === 0 ? Effect.void : Effect.uninterruptible(flush(database.write))))),
				Effect.forever,
				Effect.provideService(Clock.Clock, clock),
				Effect.forkScoped,
			);
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
