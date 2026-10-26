import { Cause } from "effect";
import { expect } from "vitest";
import { nativeStackDiagnostics, publicStackDiagnostics } from "#test/app-host/nativeStackDiagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const INTERRUPTING_FIBER_ID = 123;

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`deep public native stack chains still reach reporters and ${protocol} traces`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), publicStackDiagnostics],
		function* ({ postNdjson, reportedCauses, close, exportedSpans }) {
			const response = yield* postNdjson(
				`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: { depth: 10, kind: "interruption", marker: "public-frame" }, tag: "nativeStack" })}\n`,
				false,
			);
			expect(response.status).toBe(200);
			expect(reportedCauses()).toEqual([expect.objectContaining({ reasons: expect.any(Array) })]);
			expect(
				reportedCauses()
					.map((cause) => Cause.pretty(cause))
					.join("\n"),
			).toContain("public-frame-9");
			expect(
				reportedCauses()
					.map((cause) => Cause.pretty(cause))
					.join("\n"),
			).toContain("public-frame-2");
			yield* close();
			const span = exportedSpans().find((value) => value.name === "nativeStack");
			const exception = span?.events.find((event) => event.name === "exception");
			expect(exception?.attributes.find((attribute) => attribute.key === "exception.stacktrace")?.value.stringValue).toContain("public-frame-9");
			expect(exception?.attributes.find((attribute) => attribute.key === "exception.stacktrace")?.value.stringValue).toContain("public-frame-2");
		},
	);
	for (const kind of ["defect", "interruption"] as const) {
		host.it(
			`removes native ${kind} stack annotations from reporters and ${protocol} traces`,
			[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), nativeStackDiagnostics],
			function* ({ postNdjson, reportedCauses, close, exportedSpans }) {
				const marker = "private-native-stack-marker";
				const response = yield* postNdjson(
					`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: { fiberId: INTERRUPTING_FIBER_ID, kind, marker }, tag: "nativeStack" })}\n`,
					false,
				);
				expect(response.status).toBe(200);
				const reasons = reportedCauses().flatMap((cause) => cause.reasons);
				expect(reasons.map((reason) => reason._tag)).toEqual(kind === "defect" ? ["Die"] : ["Die", "Interrupt"]);
				if (kind === "interruption") {
					expect(reasons.find(Cause.isInterruptReason)?.fiberId).toBe(INTERRUPTING_FIBER_ID);
				}
				for (const reason of reasons) {
					expect(reason.annotations.has(Cause.StackTrace.key)).toBe(false);
					expect(reason.annotations.has(Cause.InterruptorStackTrace.key)).toBe(false);
					expect(reason.annotations.get("publicReasonNote")).toBe("public reason detail");
				}
				yield* close();
				const span = exportedSpans().find((value) => value.name === "nativeStack");
				expect(span?.events).toEqual(expect.arrayContaining([expect.objectContaining({ name: "exception" })]));
				expect(JSON.stringify(exportedSpans())).not.toContain(marker);
			},
		);
	}
}
