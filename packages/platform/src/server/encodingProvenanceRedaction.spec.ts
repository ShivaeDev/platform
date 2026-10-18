import { Effect } from "effect";
import { expect } from "vitest";
import { branchedEncoding, scalarEncoding } from "#test/app-host/encodingProvenance.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

host.it(
	"masks every possible output field in both boolean branches of a sensitive encoder",
	[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } }), branchedEncoding],
	function* ({ postNdjson, logs, close, exportedSpans }) {
		const value = "private branched contact";
		const responses = yield* Effect.forEach([false, true], (swap) =>
			postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: String(swap), payload: { swap, value }, tag: "branched" })}\n`, false),
		);
		for (const response of responses) {
			expect(response.status).toBe(200);
			expect(response.body).toContain('"_tag":"Fail"');
			expect(response.body).toContain('"left":"<redacted>"');
			expect(response.body).toContain('"right":"<redacted>"');
			expect(response.body).not.toContain(value);
		}
		const diagnostics = logs().filter((entry) => Array.isArray(entry.message) && entry.message.includes("branched diagnostic"));
		expect(diagnostics).toHaveLength(2);
		for (const diagnostic of diagnostics) {
			expect(diagnostic.annotations).toMatchObject({ left: "<redacted>", right: "<redacted>", visible: "public control" });
		}
		yield* close();
		const spans = exportedSpans().filter((span) => span.name === "branched");
		expect(spans).toHaveLength(2);
		for (const span of spans) {
			expect(span.attributes).toEqual(
				expect.arrayContaining([
					{ key: "left", value: { stringValue: "<redacted>" } },
					{ key: "right", value: { stringValue: "<redacted>" } },
					{ key: "visible", value: { stringValue: "public control" } },
				]),
			);
		}
	},
);

for (const source of ["schema", "host"] as const) {
	host.it(
		`protects the enclosing field when a sensitive ${source} descendant encodes as a scalar`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } }), scalarEncoding(source)],
		function* ({ postNdjson, logs, close, exportedSpans }) {
			const value = "private scalar contact";
			const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: { value }, tag: "scalar" })}\n`, false);
			expect(response.status).toBe(200);
			expect(response.body).toContain('"_tag":"Fail"');
			expect(response.body).toContain('"profile":"<redacted>"');
			expect(response.body).toContain('"visible":"public control"');
			expect(response.body).not.toContain(value);
			const diagnostic = logs().find((entry) => Array.isArray(entry.message) && entry.message.includes("scalar diagnostic"));
			expect(diagnostic?.annotations).toMatchObject({ profile: "<redacted>", visible: "public control" });
			yield* close();
			expect(exportedSpans().find((span) => span.name === "scalar")?.attributes).toEqual(
				expect.arrayContaining([
					{ key: "profile", value: { stringValue: "<redacted>" } },
					{ key: "visible", value: { stringValue: "public control" } },
				]),
			);
		},
	);
}
