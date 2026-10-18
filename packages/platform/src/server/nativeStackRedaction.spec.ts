import { Cause } from "effect";
import { expect } from "vitest";
import { nativeStackDiagnostics } from "#test/app-host/nativeStackDiagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	for (const kind of ["defect", "interruption"] as const) {
		host.it(
			`removes native ${kind} stack annotations from reporters and ${protocol} traces`,
			[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), nativeStackDiagnostics],
			function* ({ postNdjson, reportedCauses, close, exportedSpans }) {
				const marker = "private-native-stack-marker";
				const response = yield* postNdjson(
					`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: { kind, marker }, tag: "nativeStack" })}\n`,
					false,
				);
				expect(response.status).toBe(200);
				const reasons = reportedCauses().flatMap((cause) => cause.reasons);
				expect(reasons.map((reason) => reason._tag)).toEqual(kind === "defect" ? ["Die"] : ["Die", "Interrupt"]);
				if (kind === "interruption") {
					expect(reasons.find(Cause.isInterruptReason)?.fiberId).toBe(123);
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
