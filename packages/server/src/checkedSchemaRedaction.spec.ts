import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { checkedDiagnostics } from "#test/app-host/checkedDiagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const masked = { contact: "<redacted>", visible: "public detail" };

for (const check of ["filter", "group", "nestedFilter", "nestedGroup"] as const) {
	host.it(
		`a contact made sensitive by a ${check} check is masked in the client failure, the diagnostic log and exported span attributes`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } }), checkedDiagnostics(check)],
		function* ({ answerMentions, callRpc, close, diagnosticLog, exportMentions, logMentions, spanAttributes, wireAnswers }) {
			const contact = `private-${check}-contact`;

			yield* callRpc("diagnose", { contact, visible: "public detail" });

			yield* close();

			yield* outcomes({
				"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining(masked) } }],
				"diagnostic log": [diagnosticLog("diagnostic"), expect.objectContaining(masked)],
				"leaked into exports": [exportMentions(contact), []],
				"leaked into logs": [logMentions(contact), []],
				"leaked into the answer": [answerMentions(contact), []],
				"span attributes": [spanAttributes("diagnose"), [expect.objectContaining(masked)]],
			});
		},
	);
}
