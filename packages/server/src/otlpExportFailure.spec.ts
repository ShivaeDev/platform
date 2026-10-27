import { expect } from "vitest";
import { host } from "#test/app-host/story.ts";
import { collector, flushable } from "#test/app-host/telemetry.ts";

for (const status of [400, 503, undefined]) {
	host.it(
		`warns once on the first export failure (${status}), with the redacted collector answer when present`,
		[
			collector({
				...(status === undefined ? { offline: true } : { status }),
				answer: "Unsupported content type; token=hidden-collector-token",
				env: { "OTEL_EXPORTER_OTLP_HEADERS": "authorization=hidden-exporter-secret" },
			}),
			flushable(),
		],
		function* ({ ping, flush, close, logs, exports }) {
			expect(yield* ping()).toBe("pong");
			yield* flush();
			expect(yield* ping()).toBe("pong");
			yield* flush();
			yield* close();
			const warnings = logs().filter(({ level }) => level === "Warn");
			expect(warnings).toMatchObject([{ message: ["OTLP trace export failed"] }]);
			if (status === undefined) {
				expect(warnings[0]?.annotations).toMatchObject({ "otlp.failure": "TransportError" });
			} else {
				expect(exports().slice(0, warnings[0]?.attempt)).toMatchObject([{ path: "/v1/traces" }]);
				expect(warnings[0]?.annotations).toMatchObject({ "otlp.response": "Unsupported content type; token=<redacted>", "otlp.status": status });
			}
			expect(JSON.stringify(logs())).not.toContain("hidden-");
		},
		10_000,
	);
}
host.it(
	"warns again after the collector recovers",
	[collector({ status: (attempt) => [400, 400, 200, 400][attempt - 1] ?? 200 })],
	function* ({ ping, collectorResponses }) {
		expect(yield* ping()).toBe("pong");
		expect(yield* collectorResponses([400, 400, 200, 400])).toEqual([1, 1, 1, 2]);
	},
);
