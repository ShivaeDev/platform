import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { encodedFailures } from "#test/app-host/encodedFailures.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const renamed = { visible: "<redacted>", wireValue: "<redacted>" };

host.it(
	"a schema-encoded Error failure reaches the client with its sensitive message and stack masked",
	[encodedFailures],
	function* ({ answerMentions, callRpc, wireAnswers }) {
		yield* callRpc("errorStack", { value: "private failure detail" });

		yield* outcomes({
			"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining({ message: "<redacted>", stack: "<redacted>" }) } }],
			"leaked into the answer": [answerMentions("private failure detail"), []],
		});
	},
);

host.it(
	"a value-dependent transform that loses field provenance masks the whole encoded field",
	[encodedFailures],
	function* ({ answerMentions, callRpc, wireAnswers }) {
		yield* callRpc("computedFailure", { value: "private computed detail" });

		yield* outcomes({
			"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining({ computedWire: "<redacted>" }) } }],
			"leaked into the answer": [answerMentions("PRIVATE COMPUTED DETAIL"), []],
		});
	},
);

host.it(
	"schema sensitivity follows renamed keys into the client failure and the diagnostic log",
	[encodedFailures],
	function* ({ answerMentions, callRpc, diagnosticLog, wireAnswers }) {
		yield* callRpc("renamedFailure", { value: "private sealed detail" });

		yield* outcomes({
			"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining({ ...renamed, _tag: "<redacted>" }) } }],
			"diagnostic log": [diagnosticLog("encoded failure"), expect.objectContaining({ ...renamed, control: "public control", sealed: "<redacted>" })],
			"leaked into the answer": [answerMentions("private sealed detail"), []],
		});
	},
);

host.it(
	"a password field stays masked when its schema renames it to an ordinary wire key",
	[encodedFailures],
	function* ({ answerMentions, callRpc, wireAnswers }) {
		yield* callRpc("renamedPassword", { value: "private password detail" });

		yield* outcomes({
			"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining({ wireCode: "<redacted>" }) } }],
			"leaked into the answer": [answerMentions("private password detail"), []],
		});
	},
);

for (const protocol of ["http/json", "http/protobuf"]) {
	host.it(
		`schema sensitivity follows renamed keys into ${protocol} span attributes`,
		[collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": protocol } }), encodedFailures],
		function* ({ callRpc, close, exportMentions, spanAttributes }) {
			yield* callRpc("renamedFailure", { value: "private sealed detail" });

			yield* close();

			yield* outcomes({
				"leaked into exports": [exportMentions("private sealed detail"), []],
				"span attributes": [spanAttributes("renamedFailure"), [expect.objectContaining({ ...renamed, control: "public control" })]],
			});
		},
	);
}
