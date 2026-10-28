import { inspect } from "node:util";
import { Cause } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { nestedErrors } from "#test/app-host/nestedErrors.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const protocol of ["http/json", "http/protobuf"]) {
	for (const field of ["message", "name"] as const) {
		for (const kind of ["defect", "failure"] as const) {
			host.it(
				`hides nested Error ${field} headers in logs, ${kind} reports and ${protocol} span attributes`,
				[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), nestedErrors(field)],
				function* ({ postNdjson, logs, reportedCauses, close, exportedSpans }) {
					const secret = `private-inner-${field}`;
					const payload = { field, kind, value: secret };
					const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "nestedErrors" })}\n`, false);
					expect(response.status).toBe(HttpStatus.fromLiteral("OK"));
					expect(response.body).not.toContain(secret);
					const log = logs().find((entry) => Array.isArray(entry.message) && entry.message.includes("nested errors"));
					expect(log?.annotations).toMatchObject({
						diagnostic: { failure: { cause: { [field]: "<redacted>", stack: "<redacted>" } }, visible: "public diagnostic" },
					});
					expect(inspect(log, { depth: 20 })).not.toContain(secret);
					expect(reportedCauses()).toEqual([expect.objectContaining({ reasons: expect.any(Array) })]);
					const [reported] = reportedCauses();
					if (reported === undefined) {
						throw new Error("Expected a reported nested Error");
					}
					expect(Cause.squash(reported)).toMatchObject({ cause: { [field]: "<redacted>", stack: "<redacted>" } });
					expect(Cause.squash(reported)).toMatchObject({ details: { errors: [{ stack: "<redacted>" }, { stack: "<redacted>" }] } });
					expect(inspect(reported, { depth: 20 })).not.toContain(secret);
					yield* close();
					const span = exportedSpans().find((value) => value.name === "nestedErrors");
					const attribute = span?.attributes.find((value) => value.key === "diagnostic");
					expect(JSON.stringify(attribute)).toContain("public diagnostic");
					expect(JSON.stringify(attribute)).toContain("<redacted>");
					expect(JSON.stringify(exportedSpans())).not.toContain(secret);
				},
			);
		}
	}
}
