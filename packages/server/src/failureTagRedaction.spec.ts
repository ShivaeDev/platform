import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { sensitiveFailureTag } from "#test/app-host/sensitiveFailureTag.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

for (const source of ["schema", "host"] as const) {
	host.it(
		`a ${source}-sensitive error tag is masked in the RPC failure log and absent from the client answer, which keeps the public detail`,
		[sensitiveFailureTag(source)],
		function* ({ answerMentions, callRpc, diagnosticLog, logMentions }) {
			yield* callRpc("taggedFailure", { _tag: "private-marker" });

			yield* outcomes({
				"answer text": [answerMentions("public detail", "private-marker"), ["public detail"]],
				"failure log": [
					diagnosticLog("RPC failure"),
					expect.objectContaining({ "rpc.failure": "<redacted>", "rpc.method": "taggedFailure", "rpc.payload": { _tag: "<redacted>" } }),
				],
				"leaked into logs": [logMentions("private-marker"), []],
			});
		},
	);
}

host.it(
	"a sibling RPC's sensitive tag and message do not redact a public conflict in the same batch",
	[sensitiveFailureTag("schema")],
	function* ({ callRpcs, wireAnswers }) {
		yield* callRpcs([
			{ id: "private", payload: { _tag: "private-marker" }, tag: "taggedFailure" },
			{ id: "public", payload: null, tag: "publicConflict" },
		]);

		expect(yield* wireAnswers()).toEqual({
			private: { failed: { _tag: "<redacted>", detail: "public detail", message: "<redacted>" } },
			public: { failed: { _tag: "Conflict", message: "Name is taken" } },
		});
	},
);

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`a sibling's sensitive tag and message leave public failure logs and ${protocol} span attributes readable`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), sensitiveFailureTag("schema")],
		function* ({ callRpc, close, diagnosticLog, spanAttributes }) {
			yield* callRpc("publicConflict", null);

			yield* close();

			yield* outcomes({
				"child span attributes": [spanAttributes("publicConflict child"), [expect.objectContaining({ _tag: "Conflict", message: "Name is taken" })]],
				"diagnostic": [diagnosticLog("public conflict"), expect.objectContaining({ _tag: "Conflict", message: "Name is taken" })],
				"failure tag": [diagnosticLog("RPC failure"), expect.objectContaining({ "rpc.failure": "Conflict" })],
				"span attributes": [spanAttributes("publicConflict"), [expect.objectContaining({ _tag: "Conflict", message: "Name is taken" })]],
			});
		},
	);
}

host.it(
	"a sibling's sensitive tag and message leave a public defect readable in its RPC diagnostic",
	[sensitiveFailureTag("schema")],
	function* ({ callRpc, diagnosticLog }) {
		yield* callRpc("publicDefect", null);

		expect(yield* diagnosticLog("RPC defect")).toMatchObject({ "rpc.defect": [{ _tag: "PublicDefect", message: "Public defect detail" }] });
	},
);
