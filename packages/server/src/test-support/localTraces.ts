import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Cause, ConfigProvider, Effect, Exit, Layer, Option, Scope, Tracer } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { localTracing } from "#localTracing.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";

function credential(key: string) {
	return key === "privateField" || /password/iu.test(key);
}
const policy = Object.assign(credential, {
	forRpc: (tag: string | undefined) => (key: string) => credential(key) || (tag === "checkout" && key === "rpcSecret"),
});

export const localTraces = storyKit({
	clock: "test",
	*create() {
		const root = mkdtempSync(join(tmpdir(), "platform-traces-"));
		yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
		const path = join(root, "nested", "traces.db");
		const nativeSpans: Tracer.NativeSpan[] = [];
		const nativeTracer = Tracer.make({
			span: (options) => {
				const span = new Tracer.NativeSpan(options);
				nativeSpans.push(span);
				return span;
			},
		});
		return { nativeSpans, nativeTracer, path };
	},
	name: "local development traces",
	stages: [],
	verbs: ({ nativeSpans, nativeTracer, path }, story) => ({
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
			const recorder: Layer.Layer<never, unknown> = automatic
				? otlpTracing
				: localTracing({ flushInterval: 1000, indexedAttributes: ["orderId", "password"], path, retainedRuns: 2 });
			const provider = ConfigProvider.fromEnv({
				env: { "NODE_ENV": mode, "PLATFORM_TRACE_INDEXED_ATTRIBUTES": "orderId,password", "PLATFORM_TRACE_STORE": path },
			});
			const context = yield* Layer.buildWithScope(
				recorder.pipe(
					Layer.provide(Layer.succeed(Tracer.Tracer, nativeTracer)),
					Layer.provide(Layer.succeed(RedactionPolicy, policy)),
					Layer.provide(ConfigProvider.layer(provider)),
				),
				scope,
			);
			return {
				close: () => Scope.close(scope, Exit.void),
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
			};
		},
		read: () => Effect.sync(() => readLocalTraces(path)),
		secondPasses: () => TestClock.adjust(1000),
		storeExists: () => Effect.sync(() => existsSync(path)),
	}),
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
