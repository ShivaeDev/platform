import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nestedErrors } from "#test/app-host/nestedErrors.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const fields = ["message", "name"] as const;
const kinds = ["defect", "failure"] as const;

const maskedStack = expect.objectContaining({ stack: "<redacted>" });

for (const field of fields) {
	const maskedCause = expect.objectContaining({ [field]: "<redacted>", stack: "<redacted>" });
	const maskedDiagnostic = expect.objectContaining({
		diagnostic: expect.objectContaining({ failure: expect.objectContaining({ cause: maskedCause }), visible: "public diagnostic" }),
	});
	for (const kind of kinds) {
		host.it(
			`a nested Error's sensitive ${field} and every nested stack are masked in the diagnostic log and the ${kind} report`,
			[nestedErrors(field)],
			function* ({ answerMentions, callRpc, diagnosticLog, diagnosticLogMentions, reportedErrors, reportMentions }) {
				const secret = `private-inner-${field}`;

				yield* callRpc("nestedErrors", { field, kind, value: secret });

				yield* outcomes({
					"diagnostic log": [diagnosticLog("nested errors"), maskedDiagnostic],
					"leaked into reports": [reportMentions(secret), []],
					"leaked into the answer": [answerMentions(secret), []],
					"leaked into the diagnostic log": [diagnosticLogMentions("nested errors", secret), []],
					"reported error": [reportedErrors(), [expect.objectContaining({ cause: maskedCause, details: { errors: [maskedStack, maskedStack] } })]],
				});
			},
		);
	}
}

for (const protocol of ["http/json", "http/protobuf"]) {
	for (const field of fields) {
		for (const kind of kinds) {
			host.it(
				`a ${protocol} export keeps the public diagnostic of a ${kind} but masks its nested Error ${field}`,
				[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), nestedErrors(field)],
				function* ({ callRpc, close, exportMentions }) {
					const secret = `private-inner-${field}`;

					yield* callRpc("nestedErrors", { field, kind, value: secret });

					yield* close();

					expect(yield* exportMentions("public diagnostic", "<redacted>", secret)).toEqual(["public diagnostic", "<redacted>"]);
				},
			);
		}
	}
}
