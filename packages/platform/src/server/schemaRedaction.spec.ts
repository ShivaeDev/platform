import { Cause, Exit, Option } from "effect";
import { expect } from "vitest";
import { nativeTracing } from "#test/app-host/nativeTracing.ts";
import { schemaDiagnostics } from "#test/app-host/schemaDiagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const HTTP_OK = 200;

host.it(
	"redacts the client failure while preserving application values in a native tracer",
	[schemaDiagnostics, nativeTracing],
	function* ({ postNdjson, close, nativeSpans }) {
		const payload = { customerRef: "customer-123", sealed: "plain-code", sensitiveNote: "private note", visible: "public detail" };
		const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "diagnose" })}\n`, false);
		expect(response.body).toContain('"sealed":"<redacted>"');
		yield* close();
		const span = nativeSpans().find((value) => value.kind === "server" && value.name === "diagnose");
		if (span?.status._tag !== "Ended" || !Exit.isFailure(span.status.exit)) {
			throw new Error("Expected a failed native RPC span");
		}
		expect(Option.getOrThrow(Cause.findErrorOption(span.status.exit.cause))).toMatchObject({
			customerRef: payload.customerRef,
			sensitiveNote: payload.sensitiveNote,
		});
	},
);

host.it("sensitive declarations mask fields without scanning their values in ordinary prose", [schemaDiagnostics], function* ({ postNdjson, logs }) {
	const payload = {
		customerRef: "customer-123",
		sealed: "plain-code",
		sensitiveNote: "private note",
		visible: "The plain-code appears in ordinary prose",
	};
	const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "diagnose" })}\n`, false);
	expect(response.body).toContain('"sealed":"<redacted>"');
	expect(response.body).toContain(payload.visible);
	const diagnostic = logs().find((log) => Array.isArray(log.message) && log.message.includes("diagnostic"));
	expect(diagnostic?.annotations).toMatchObject({ sealed: "<redacted>", visible: payload.visible });
});

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`schema fields and host keys stay hidden in logs, RPC failures and ${protocol} spans`,
		[
			collector({
				env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol, "OTEL_RESOURCE_ATTRIBUTES": "customerRef=hidden-resource,sealed=hidden-resource-sealed" },
			}),
			schemaDiagnostics,
		],
		function* ({ postNdjson, logs, close, exportedSpans, exports, reportedCauses }) {
			const payload = {
				customerRef: "hidden-customer",
				notes: ["ordinary note", { mailingLine: "hidden-line" }],
				privateLabels: { unusualLabel: "hidden-label" },
				recoveryCodes: ["hidden-code"],
				sealed: "hidden-sealed",
				sensitiveNote: "hidden-note unmatched-private-fragment",
				visible: "ordinary prose stays visible",
			};
			const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "diagnose" })}\n`, false);
			expect(response.status).toBe(HTTP_OK);
			expect(response.body).toContain('"_tag":"Rejected"');
			for (const key of ["sealed", "sensitiveNote", "customerRef", "mailingLine", "internalReference", "privateLabels", "recoveryCodes"]) {
				expect(response.body).toContain(`"${key}":"<redacted>"`);
			}
			const diagnostic = logs().find((log) => Array.isArray(log.message) && log.message.includes("diagnostic"));
			expect(diagnostic?.annotations).toMatchObject({
				customerRef: "<redacted>",
				sealed: "<redacted>",
				sensitiveNote: "<redacted>",
				visible: payload.visible,
			});
			expect(reportedCauses()).toEqual([expect.objectContaining({ reasons: expect.any(Array) })]);
			expect(reportedCauses()[0]?.reasons).toMatchObject([
				{ error: { customerRef: "<redacted>", sealed: "<redacted>", sensitiveNote: "<redacted>" } },
			]);
			yield* close();
			const spans = exportedSpans();
			expect(spans.find((span) => span.name === "diagnose")?.attributes).toEqual(
				expect.arrayContaining([
					{ key: "sealed", value: { stringValue: "<redacted>" } },
					{ key: "sensitiveNote", value: { stringValue: "<redacted>" } },
					{ key: "customerRef", value: { stringValue: "<redacted>" } },
					{ key: "visible", value: { stringValue: payload.visible } },
				]),
			);
			for (const value of [
				response.body,
				JSON.stringify(logs()),
				JSON.stringify(spans),
				JSON.stringify(reportedCauses()),
				exports()
					.map((item) => item.body)
					.join(""),
			]) {
				expect(value).not.toContain("hidden-");
				expect(value).not.toContain("unmatched-private-fragment");
				expect(value).toContain(payload.visible);
			}
		},
	);
}

host.it(
	"host redaction hides defect fields while successful RPC results keep application data",
	[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } }), schemaDiagnostics],
	function* ({ postNdjson, logs, close, exportedSpans }) {
		const payload = { customerRef: "hidden-customer", sealed: "hidden-sealed", sensitiveNote: "hidden-note", visible: "public detail" };
		const defect = yield* postNdjson(
			`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: { ...payload, defect: true }, tag: "diagnose" })}\n`,
			false,
		);
		expect(defect.body).toContain("diagnostic defect");
		expect(defect.body).not.toContain("hidden-");
		const success = yield* postNdjson(
			`${JSON.stringify({ _tag: "Request", headers: [], id: "2", payload: { ...payload, succeed: true }, tag: "diagnose" })}\n`,
			false,
		);
		expect(success.body).toContain('"value":"hidden-customer"');
		yield* close();
		expect(JSON.stringify(logs())).not.toContain("hidden-");
		expect(JSON.stringify(exportedSpans())).not.toContain("hidden-");
	},
);
