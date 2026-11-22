import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Cause, Clock, ConfigProvider, Effect, Exit, Fiber, Layer, Logger, Option, Scope, Tracer } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { passes, untilTimer } from "@shivaedev/test-story/server/watchedClock.ts";
import { localTracing } from "#localTracing.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";

function credential(key: string) {
	return key === "privateField" || /password/iu.test(key);
}
const policy = Object.assign(credential, {
	forRpc: (tag: string | undefined) => (key: string) => credential(key) || (tag === "checkout" && key === "rpcSecret"),
});

// The recorder's first wait for a held store.
const FIRST_BUSY_WAIT = "10 millis";

function shutdownOutcome(close: Effect.Effect<void>) {
	return Effect.exit(close).pipe(Effect.map((exit) => (Exit.isSuccess(exit) ? "closed" : `failed: ${String(Cause.squash(exit.cause))}`)));
}

export const localTraces = storyKit({
	clock: "test",
	*create() {
		const root = mkdtempSync(join(tmpdir(), "platform-traces-"));
		yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
		const path = join(root, "nested", "traces.db");
		const writer: { held?: DatabaseSync } = {};
		const warnings: string[] = [];
		const nativeSpans: Tracer.NativeSpan[] = [];
		const nativeTracer = Tracer.make({
			span: (options) => {
				const span = new Tracer.NativeSpan(options);
				nativeSpans.push(span);
				return span;
			},
		});
		return { nativeSpans, nativeTracer, path, warnings, writer };
	},
	name: "local development traces",
	stages: [],
	verbs: ({ nativeSpans, nativeTracer, path, warnings, writer }, story) => {
		function recorderLayer(automatic: boolean, mode: string, clock: Clock.Clock) {
			const recorder: Layer.Layer<never, unknown> = automatic
				? otlpTracing
				: localTracing({ clock, flushInterval: 1000, indexedAttributes: ["orderId", "password"], path, retainedRuns: 2 });
			const provider = ConfigProvider.fromEnv({
				env: { "NODE_ENV": mode, "PLATFORM_TRACE_INDEXED_ATTRIBUTES": "orderId,password", "PLATFORM_TRACE_STORE": path },
			});
			const warned = Logger.make(({ logLevel, message }) => {
				if (logLevel === "Warn") {
					warnings.push(String(message));
				}
			});
			return recorder.pipe(
				Layer.provide(Logger.layer([warned], { mergeWithExisting: true })),
				Layer.provide(Layer.succeed(Tracer.Tracer, nativeTracer)),
				Layer.provide(Layer.succeed(RedactionPolicy, policy)),
				Layer.provide(ConfigProvider.layer(provider)),
			);
		}
		return {
			anotherWriterDropsSpansTable: () =>
				Effect.sync(() => {
					story.tell("another writer drops the store's spans table");
					const db = new DatabaseSync(path);
					db.exec("DROP TABLE spans");
					db.close();
				}),
			anotherWriterHoldsStore: () =>
				Effect.gen(function* () {
					story.tell("another writer opens a write transaction on the store and keeps it open");
					const db = new DatabaseSync(path);
					// Added after the recorders' finalizers, so the writer lets go before they close at the story's end.
					yield* Effect.addFinalizer(() => Effect.sync(() => db.close()));
					db.exec("BEGIN IMMEDIATE");
					writer.held = db;
				}),
			flushPassesWhileStoreStaysHeld: () =>
				Effect.gen(function* () {
					story.tell("the flush interval passes and the store stays held for two seconds more");
					yield* TestClock.adjust(1000);
					yield* untilTimer(FIRST_BUSY_WAIT);
					yield* TestClock.adjust("2 seconds");
				}),
			loggedWarnings: () => Effect.sync(() => [...warnings]),
			nativeFailure: () =>
				Effect.sync(() => {
					const span = nativeSpans.find((entry) => entry.name === "failed");
					if (span?.status._tag === "Ended" && Exit.isFailure(span.status.exit)) {
						return Option.getOrUndefined(Cause.findErrorOption(span.status.exit.cause));
					}
					return undefined;
				}),
			nativeSpanNames: () => Effect.sync(() => nativeSpans.map((span) => span.name)),
			*open(automatic = false, mode = "development") {
				story.tell("a scoped trace recorder opens");
				const scope = yield* Scope.make();
				yield* Effect.addFinalizer(() => Scope.close(scope, Exit.void));
				const context = yield* Layer.buildWithScope(recorderLayer(automatic, mode, yield* Clock.Clock), scope);
				function shutDown() {
					return shutdownOutcome(Scope.close(scope, Exit.void));
				}
				return {
					close: () => Scope.close(scope, Exit.void),
					closeAsStoreFrees: () =>
						Effect.gen(function* () {
							story.tell("the recorder closes, and the other writer lets go of the store while the recorder waits");
							const closing = yield* Effect.forkChild(shutDown());
							yield* untilTimer(FIRST_BUSY_WAIT);
							writer.held?.exec("ROLLBACK");
							return yield* passes(FIRST_BUSY_WAIT, Fiber.join(closing));
						}),
					closeWhileStoreStaysHeld: () =>
						Effect.gen(function* () {
							story.tell("the recorder closes and the store stays held for two seconds");
							const closing = yield* Effect.forkChild(shutDown());
							yield* untilTimer(FIRST_BUSY_WAIT);
							return yield* passes("2 seconds", Fiber.join(closing));
						}),
					nested: () =>
						Effect.annotateCurrentSpan({ rpcSecret: "hidden-child" }).pipe(
							Effect.withSpan("child"),
							Effect.withSpan("rpc", { attributes: { "rpc.method": "checkout" } }),
							Effect.provide(context),
						),
					record: (name = "checkout", sampled = true) => {
						story.tell(`the application records ${name} and its log`);
						return Effect.gen(function* () {
							yield* Effect.annotateCurrentSpan({ orderId: "order-42", password: "hidden-span", privateField: "hidden-custom" });
							yield* Effect.logInfo("password=hidden-log").pipe(Effect.annotateLogs({ orderId: "order-42", privateField: "hidden-annotation" }));
						}).pipe(Effect.withSpan(name, { sampled }), Effect.provide(context));
					},
					reject: (error: unknown) => Effect.fail(error).pipe(Effect.withSpan("failed"), Effect.exit, Effect.provide(context)),
					shutDown,
				};
			},
			openWhileStoreStaysHeld: () =>
				Effect.gen(function* () {
					story.tell("another recorder opens and the store stays held for two seconds");
					const opening = yield* Effect.forkChild(
						Effect.scoped(Layer.build(recorderLayer(false, "development", yield* Clock.Clock))).pipe(
							Effect.exit,
							Effect.map((exit) => (Exit.isSuccess(exit) ? "opened" : `failed: ${String(Cause.squash(exit.cause))}`)),
						),
					);
					yield* untilTimer(FIRST_BUSY_WAIT);
					return yield* passes("2 seconds", Fiber.join(opening));
				}),
			pruneLookupPlan: () =>
				Effect.sync(() => {
					const db = new DatabaseSync(path, { readOnly: true });
					try {
						return db
							.prepare("EXPLAIN QUERY PLAN DELETE FROM span_attributes WHERE span_id = ?")
							.all("span")
							.map((step) => String(step.detail));
					} finally {
						db.close();
					}
				}),
			read: () => Effect.sync(() => readLocalTraces(path)),
			secondPasses: () => TestClock.adjust(1000),
			storeExists: () => Effect.sync(() => existsSync(path)),
		};
	},
});

export function readLocalTraces(path: string) {
	const db = new DatabaseSync(path, { readOnly: true });
	try {
		return {
			attributes: db.prepare("SELECT key, value FROM span_attributes ORDER BY key").all(),
			logs: db.prepare("SELECT trace_id, span_id, data FROM logs").all(),
			runs: db.prepare("SELECT id FROM runs ORDER BY rowid").all(),
			spans: db.prepare("SELECT name, run_id, trace_id, span_id, data FROM spans ORDER BY rowid").all(),
		};
	} finally {
		db.close();
	}
}
