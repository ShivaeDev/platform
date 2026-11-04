import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { collector } from "#test/app-host/telemetry.ts";
import { localTraceHost } from "#test/localTraceHost.ts";

localTraceHost.it(
	"a development host records a real HTTP request and its correlated log locally with the host redaction policy",
	[],
	function* ({ close, request, storedTraces }) {
		yield* request("/checkout");
		yield* close();
		const { attributes, logs, spans } = yield* storedTraces();
		const span = spans.find((row) => row.name === "checkout");
		expect(span).toBeDefined();
		expect(logs).toContainEqual(expect.objectContaining({ "span_id": span?.span_id, "trace_id": span?.trace_id }));
		expect(attributes).toContainEqual({ key: "orderId", value: "order-42" });
		expect(attributes).toContainEqual({ key: "privateField", value: "<redacted>" });
		expect(JSON.stringify({ attributes, logs, spans })).not.toContain("hidden-");
	},
);

localTraceHost.it(
	"an explicit collector takes precedence over local recording in development",
	[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } })],
	function* ({ close, request, spanAttributes, storeExists }) {
		yield* request("/checkout");
		yield* close();
		yield* outcomes([
			["exported span", () => spanAttributes("checkout"), [expect.objectContaining({ orderId: "order-42", privateField: "<redacted>" })]],
			["local store created", () => storeExists(), false],
		]);
	},
);
