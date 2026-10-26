import { expect } from "vitest";
import { checkedDiagnostics } from "#test/app-host/checkedDiagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const check of ["filter", "group", "nestedFilter", "nestedGroup"] as const) {
	host.it(
		`${check} sensitivity hides contact from logs, client failures and exported spans`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } }), checkedDiagnostics(check)],
		function* ({ postNdjson, logs, close, exportedSpans }) {
			const payload = { contact: `private-${check}-contact`, visible: "public detail" };
			const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "diagnose" })}\n`, false);
			expect(response.status).toBe(200);
			expect(response.body).toContain('"_tag":"Fail"');
			expect(response.body).toContain('"contact":"<redacted>"');
			expect(response.body).toContain(payload.visible);
			expect(response.body).not.toContain(payload.contact);
			const diagnostic = logs().find((log) => Array.isArray(log.message) && log.message.includes("diagnostic"));
			expect(diagnostic?.annotations).toMatchObject({ contact: "<redacted>", visible: payload.visible });
			yield* close();
			const spans = exportedSpans();
			expect(spans.find((span) => span.name === "diagnose")?.attributes).toEqual(
				expect.arrayContaining([
					{ key: "contact", value: { stringValue: "<redacted>" } },
					{ key: "visible", value: { stringValue: payload.visible } },
				]),
			);
			expect(JSON.stringify(logs())).not.toContain(payload.contact);
			expect(JSON.stringify(spans)).not.toContain(payload.contact);
		},
	);
}
