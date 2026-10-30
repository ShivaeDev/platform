import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { nativeTracing } from "#test/app-host/nativeTracing.ts";
import { schemaDiagnostics } from "#test/app-host/schemaDiagnostics.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const VISIBLE = "ordinary prose stays visible";
const hiddenPayload = {
	customerRef: "hidden-customer",
	notes: ["ordinary note", { mailingLine: "hidden-line" }],
	privateLabels: { unusualLabel: "hidden-label" },
	recoveryCodes: ["hidden-code"],
	sealed: "hidden-sealed",
	sensitiveNote: "hidden-note unmatched-private-fragment",
	visible: VISIBLE,
};
const masked = { customerRef: "<redacted>", sealed: "<redacted>", sensitiveNote: "<redacted>", visible: VISIBLE };

host.it(
	"the client failure masks every schema-sensitive field and host key and keeps visible prose",
	[schemaDiagnostics],
	function* ({ answerMentions, callRpc, wireAnswers }) {
		yield* callRpc("diagnose", hiddenPayload);

		yield* outcomes({
			"client answer": [
				wireAnswers(),
				{
					"1": {
						failed: expect.objectContaining({
							...masked,
							internalReference: "<redacted>",
							notes: ["ordinary note", { mailingLine: "<redacted>" }],
							privateLabels: "<redacted>",
							recoveryCodes: "<redacted>",
						}),
					},
				},
			],
			"leaked secrets": [answerMentions("hidden-", "unmatched-private-fragment"), []],
		});
	},
);

host.it(
	"the diagnostic log and the reported cause mask sensitive fields and keep visible prose",
	[schemaDiagnostics],
	function* ({ callRpc, diagnosticLog, logMentions, reportedErrors, reportMentions }) {
		yield* callRpc("diagnose", hiddenPayload);

		yield* outcomes({
			"diagnostic log": [diagnosticLog("diagnostic"), expect.objectContaining(masked)],
			"leaked into logs": [logMentions("hidden-", "unmatched-private-fragment"), []],
			"leaked into reports": [reportMentions("hidden-", "unmatched-private-fragment"), []],
			"reported failure": [reportedErrors(), [expect.objectContaining(masked)]],
		});
	},
);

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`a ${protocol} export masks schema-sensitive span and resource attributes and keeps visible prose`,
		[
			collector({
				env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol, "OTEL_RESOURCE_ATTRIBUTES": "customerRef=hidden-resource,sealed=hidden-resource-sealed" },
			}),
			schemaDiagnostics,
		],
		function* ({ callRpc, close, exportMentions, spanAttributes }) {
			yield* callRpc("diagnose", hiddenPayload);

			yield* close();

			yield* outcomes({
				"leaked secrets": [exportMentions("hidden-", "unmatched-private-fragment"), []],
				"span attributes": [spanAttributes("diagnose"), [expect.objectContaining(masked)]],
			});
		},
	);
}

host.it(
	"the client answer masks the sealed field while a native tracer keeps the failure's application values",
	[schemaDiagnostics, nativeTracing],
	function* ({ callRpc, close, nativeSpanFailure, wireAnswers }) {
		yield* callRpc("diagnose", { customerRef: "customer-123", sealed: "plain-code", sensitiveNote: "private note", visible: "public detail" });

		yield* close();

		yield* outcomes({
			"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining({ sealed: "<redacted>" }) } }],
			"native span failure": [nativeSpanFailure("diagnose"), expect.objectContaining({ customerRef: "customer-123", sensitiveNote: "private note" })],
		});
	},
);

host.it(
	"a sensitive declaration masks its field but not the same value in ordinary prose",
	[schemaDiagnostics],
	function* ({ callRpc, diagnosticLog, wireAnswers }) {
		const prose = "The plain-code appears in ordinary prose";

		yield* callRpc("diagnose", { customerRef: "customer-123", sealed: "plain-code", sensitiveNote: "private note", visible: prose });

		yield* outcomes({
			"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining({ sealed: "<redacted>", visible: prose }) } }],
			"diagnostic log": [diagnosticLog("diagnostic"), expect.objectContaining({ sealed: "<redacted>", visible: prose })],
		});
	},
);

host.it(
	"a defect's sensitive fields stay out of the client answer, logs and exported spans",
	[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } }), schemaDiagnostics],
	function* ({ answerMentions, callRpc, close, exportMentions, logMentions }) {
		yield* callRpc("diagnose", {
			customerRef: "hidden-customer",
			defect: true,
			sealed: "hidden-sealed",
			sensitiveNote: "hidden-note",
			visible: "public detail",
		});

		yield* close();

		yield* outcomes({
			"client answer": [answerMentions("diagnostic defect", "hidden-"), ["diagnostic defect"]],
			"leaked into exports": [exportMentions("hidden-"), []],
			"leaked into logs": [logMentions("hidden-"), []],
		});
	},
);

host.it("a successful RPC result keeps a value under a sensitive host key", [schemaDiagnostics], function* ({ callRpc, wireAnswers }) {
	yield* callRpc("diagnose", {
		customerRef: "hidden-customer",
		sealed: "hidden-sealed",
		sensitiveNote: "hidden-note",
		succeed: true,
		visible: "public detail",
	});

	expect(yield* wireAnswers()).toEqual({ "1": { succeeded: "hidden-customer" } });
});
