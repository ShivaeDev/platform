import { HttpClientError } from "effect/http";
import { expect } from "vitest";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";
import { timedExports } from "#test/app-host/timedExports.ts";

for (const stalled of ["headers", "body"]) {
	host.it(
		`fails an HTTP request with stalled ${stalled} in the typed error channel`,
		[collector(stalled === "headers" ? { status: () => undefined } : { answer: null })],
		function* ({ probeCollector, exports }) {
			const error = yield* probeCollector(80);
			expect(HttpClientError.isHttpClientError(error)).toBe(true);
			expect(error.reason).toMatchObject({ _tag: "TransportError", description: "OTLP export request timed out" });
			expect(exports()).toMatchObject([{ body: expect.stringContaining("resourceSpans"), path: "/v1/traces" }]);
		},
	);
}
const timeouts: readonly { env: Record<string, string>; timeout: number }[] = [
	{ env: {}, timeout: 10_000 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "80" }, timeout: 80 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "240" }, timeout: 240 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "5000", "OTEL_EXPORTER_OTLP_TRACES_TIMEOUT": "80" }, timeout: 80 },
	{ env: { "OTEL_EXPORTER_OTLP_TIMEOUT": "80", "OTEL_EXPORTER_OTLP_TRACES_TIMEOUT": "240" }, timeout: 240 },
];
for (const { env, timeout } of timeouts) {
	host.it(
		`times out stalled exports using ${JSON.stringify(env)} and sends a later batch`,
		[
			collector({
				env: {
					...env,
					"OTEL_BSP_MAX_EXPORT_BATCH_SIZE": "1",
					"OTEL_BSP_SCHEDULE_DELAY": "60000",
				},
				status: (attempt) => (attempt === 1 ? undefined : 200),
			}),
			timedExports,
		],
		function* ({ exportTrace, logs, waitForExport, waitForWarning, close }) {
			const started = performance.now();
			yield* exportTrace("stalled-export");
			yield* waitForWarning(timeout + 500);
			expect(logs().filter(({ level }) => level === "Warn")).toMatchObject([
				{ annotations: { "otlp.failure": "TransportError" }, message: ["OTLP trace export failed"] },
			]);
			expect(performance.now() - started).toBeGreaterThanOrEqual(timeout - 20);
			expect(performance.now() - started).toBeLessThan(timeout + 500);
			expect(logs().find(({ level }) => level === "Warn")?.annotations).toMatchObject({ "otlp.failure": "TransportError" });
			yield* exportTrace("later-export");
			yield* waitForExport("later-export");
			const closing = performance.now();
			yield* close();
			expect(performance.now() - closing).toBeLessThan(timeout + 500);
		},
		15_000,
	);
}
host.it(
	"exports on the configured batch schedule",
	[
		collector({
			env: {
				"OTEL_BSP_MAX_EXPORT_BATCH_SIZE": "100",
				"OTEL_BSP_SCHEDULE_DELAY": "40",
			},
		}),
		timedExports,
	],
	function* ({ exportTrace, exports, waitForExports }) {
		yield* exportTrace("scheduled-export");
		yield* waitForExports(1);
		expect(exports()[0]?.body).toContain("scheduled-export");
	},
);
host.it(
	"bounds shutdown with the batch export timeout",
	[
		collector({
			env: {
				"OTEL_BSP_EXPORT_TIMEOUT": "80",
			},
			status: () => undefined,
		}),
		timedExports,
	],
	function* ({ exportTrace, close, exports }) {
		yield* exportTrace("shutdown-export");
		const closing = performance.now();
		yield* close();
		expect(performance.now() - closing).toBeGreaterThanOrEqual(60);
		expect(performance.now() - closing).toBeLessThan(580);
		expect(exports()).toMatchObject([{ body: expect.stringContaining("shutdown-export"), path: "/v1/traces" }]);
	},
);
