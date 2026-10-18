import { expect } from "vitest";
import { encodedFailures } from "#test/app-host/encodedFailures.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const HTTP_OK = 200;

host.it("masks a sensitive Error message in a schema-encoded failure stack", [encodedFailures], function* ({ postNdjson }) {
	const payload = { value: "private failure detail" };
	const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "errorStack" })}\n`, false);
	expect(response.status).toBe(HTTP_OK);
	expect(response.body).toContain('"_tag":"Fail"');
	expect(response.body).toContain('"message":"<redacted>"');
	expect(response.body).toContain('"stack":"<redacted>"');
	expect(response.body).not.toContain(payload.value);
});

host.it("masks encoded fields when a value-dependent transform cannot preserve field provenance", [encodedFailures], function* ({ postNdjson }) {
	const payload = { value: "private computed detail" };
	const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "computedFailure" })}\n`, false);
	expect(response.status).toBe(HTTP_OK);
	expect(response.body).toContain('"_tag":"Fail"');
	expect(response.body).toContain('"computedWire":"<redacted>"');
	expect(response.body).not.toContain(payload.value.toUpperCase());
});

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`carries schema sensitivity to renamed keys in failures, logs and ${protocol} spans`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), encodedFailures],
		function* ({ postNdjson, logs, close, exportedSpans }) {
			const payload = { value: "private sealed detail" };
			const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "renamedFailure" })}\n`, false);
			expect(response.status).toBe(HTTP_OK);
			expect(response.body).toContain('"_tag":"Fail"');
			expect(response.body).toContain('"_tag":"<redacted>"');
			expect(response.body).toContain('"wireValue":"<redacted>"');
			expect(response.body).toContain('"visible":"<redacted>"');
			expect(response.body).not.toContain(payload.value);
			const log = logs().find((entry) => Array.isArray(entry.message) && entry.message.includes("encoded failure"));
			expect(log?.annotations).toMatchObject({ control: "public control", sealed: "<redacted>", visible: "<redacted>", wireValue: "<redacted>" });
			yield* close();
			const span = exportedSpans().find((value) => value.name === "renamedFailure");
			expect(span?.attributes).toEqual(
				expect.arrayContaining([
					{ key: "wireValue", value: { stringValue: "<redacted>" } },
					{ key: "visible", value: { stringValue: "<redacted>" } },
					{ key: "control", value: { stringValue: "public control" } },
				]),
			);
			expect(JSON.stringify(exportedSpans())).not.toContain(payload.value);
		},
	);
}
