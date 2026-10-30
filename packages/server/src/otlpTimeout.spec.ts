import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";
import { timedExports } from "#test/app-host/timedExports.ts";

for (const [stalled, options] of [
	["headers", { status: () => undefined }],
	["body", { answer: null }],
] as const) {
	host.it(
		`a collector that stalls its response ${stalled} fails the OTLP request with a typed transport timeout`,
		[collector(options)],
		function* ({ exportPaths, probeCollector }) {
			const answer = yield* probeCollector(80);

			yield* outcomes({
				"collector requests": [exportPaths(), ["/v1/traces"]],
				"export answer": [Effect.succeed(answer), "failed with transport error: OTLP export request timed out"],
			});
		},
	);
}

for (const { env, timeout } of [
	{ env: {}, timeout: 10_000 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "80" }, timeout: 80 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "240" }, timeout: 240 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "5000", "OTEL_EXPORTER_OTLP_TRACES_TIMEOUT": "80" }, timeout: 80 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "80", "OTEL_EXPORTER_OTLP_TRACES_TIMEOUT": "240" }, timeout: 240 },
]) {
	const stalledFirstExport = collector({
		env: { ...env, "OTEL_BSP_MAX_EXPORT_BATCH_SIZE": "1", "OTEL_BSP_SCHEDULE_DELAY": "60000" },
		status: (attempt) => (attempt === 1 ? undefined : HttpStatus.fromLiteral("OK")),
	});

	host.it(
		`a stalled export warns of a transport failure once ${timeout} ms pass with ${JSON.stringify(env)}`,
		[stalledFirstExport, timedExports],
		function* ({ exportDeadlineNearlyPasses, exportDeadlinePasses, exportWarnings, firstExportArrives }) {
			yield* firstExportArrives();
			yield* exportDeadlineNearlyPasses(timeout);
			expect(yield* exportWarnings()).toEqual([]);

			yield* exportDeadlinePasses();

			expect(yield* exportWarnings()).toMatchObject([{ annotations: { "otlp.failure": "TransportError" }, message: "OTLP trace export failed" }]);
		},
		{ clock: "test" },
	);

	host.it(
		`a later batch reaches the collector after a stalled export times out with ${JSON.stringify(env)}`,
		[stalledFirstExport, timedExports],
		function* ({ exportArrives, exportDeadlineNearlyPasses, exportDeadlinePasses, exportedSpanNames, firstExportArrives, traceRequest }) {
			yield* firstExportArrives();
			yield* exportDeadlineNearlyPasses(timeout);
			yield* exportDeadlinePasses();

			yield* traceRequest("later-export");
			yield* exportArrives("later-export");

			expect(yield* exportedSpanNames()).toContain("later-export");
		},
		{ clock: "test" },
	);
}

host.it(
	"spans export on the configured batch schedule",
	[collector({ env: { "OTEL_BSP_MAX_EXPORT_BATCH_SIZE": "100", "OTEL_BSP_SCHEDULE_DELAY": "40" } }), timedExports],
	function* ({ exportArrives, exportedSpanNames, traceRequest }) {
		yield* traceRequest("scheduled-export");

		yield* exportArrives("scheduled-export");

		expect(yield* exportedSpanNames()).toContain("scheduled-export");
	},
);

host.it(
	"shutdown waits for a stalled export only until the batch export timeout passes",
	[collector({ env: { "OTEL_BSP_EXPORT_TIMEOUT": "80" }, status: () => undefined }), timedExports],
	function* ({ shutdownBegins, shutdownProgress, shutdownTimeoutPasses, traceRequest }) {
		yield* traceRequest("shutdown-export");
		yield* shutdownBegins();
		expect(yield* shutdownProgress()).toBe("still shutting down");

		yield* shutdownTimeoutPasses(80);

		expect(yield* shutdownProgress()).toBe("shut down");
	},
	{ clock: "test" },
);
