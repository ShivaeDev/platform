import { inspect } from "node:util";
import { Cause } from "effect";
import { expect } from "vitest";
import { sensitiveErrorField } from "#test/app-host/sensitiveErrorField.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const HTTP_OK = 200;

for (const protocol of ["http/json", "http/protobuf"]) {
	for (const field of ["cause", "message", "name", "stack"] as const) {
		for (const kind of ["defect", "failure"] as const) {
			host.it(
				`hides a non-enumerable Error ${field} in ${kind} reports and ${protocol} exception stacks`,
				[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), sensitiveErrorField(field)],
				function* ({ postNdjson, reportedCauses, close, exportedSpans }) {
					const secret = `private-inner-${field}`;
					const payload = { field, kind, value: secret };
					const response = yield* postNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag: "errorField" })}\n`, false);
					expect(response.status).toBe(HTTP_OK);
					expect(response.body).not.toContain(secret);
					expect(reportedCauses()).toEqual([expect.objectContaining({ reasons: expect.any(Array) })]);
					const [reported] = reportedCauses();
					if (reported === undefined) {
						throw new Error("Expected a reported RPC cause");
					}
					const error = Cause.squash(reported);
					expect(error).toBeInstanceOf(Error);
					expect(error).toHaveProperty(field, "<redacted>");
					expect(inspect(error, { depth: 20 })).not.toContain(secret);
					if (field === "cause") {
						expect(error).toMatchObject({ message: "public detail", name: "Error" });
					}
					yield* close();
					const span = exportedSpans().find((value) => value.name === "errorField");
					const exception = span?.events.find((event) => event.name === "exception");
					const stack = exception?.attributes.find((attribute) => attribute.key === "exception.stacktrace")?.value.stringValue;
					expect(stack).toEqual(expect.any(String));
					if (field !== "stack") {
						expect(stack).toContain("<redacted>");
					}
					expect(JSON.stringify(exportedSpans())).not.toContain(secret);
				},
			);
		}
	}
}
