import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { ConfigProvider, Effect, Exit, Layer, Scope } from "effect";
import { TestClock } from "effect/testing";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { localTracing } from "#localTracing.ts";
import { otlpTracing } from "#otlpTracing.ts";
import { RedactionPolicy } from "#RedactionPolicy.ts";

export const localTraces = storyKit({
	clock: "test",
	*create() {
		const root = mkdtempSync(join(tmpdir(), "platform-traces-"));
		yield* Effect.addFinalizer(() => Effect.sync(() => rmSync(root, { force: true, recursive: true })));
		const path = join(root, "nested", "traces.db");
		return { path };
	},
	name: "local development traces",
	stages: [],
	verbs: ({ path }, story) => ({
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
					Layer.provide(Layer.succeed(RedactionPolicy, (key) => key === "privateField" || /password/iu.test(key))),
					Layer.provide(ConfigProvider.layer(provider)),
				),
				scope,
			);
			return {
				close: () => Scope.close(scope, Exit.void),
				record: (name = "checkout", sampled = true) => {
					story.tell(`the application records ${name} and its log`);
					return Effect.gen(function* () {
						yield* Effect.annotateCurrentSpan({ orderId: "order-42", password: "hidden-span", privateField: "hidden-custom" });
						yield* Effect.logInfo("password=hidden-log").pipe(Effect.annotateLogs({ orderId: "order-42", privateField: "hidden-annotation" }));
					}).pipe(Effect.withSpan(name, { sampled }), Effect.provide(context));
				},
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
