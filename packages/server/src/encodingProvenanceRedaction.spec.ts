import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { branchedEncoding, scalarEncoding } from "#test/app-host/encodingProvenance.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const json = collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } });

for (const swap of [false, true]) {
	host.it(
		`a sensitive encoder that ${swap ? "swaps" : "keeps"} its output fields has both possible fields masked in the client failure, the diagnostic log and span attributes`,
		[json, branchedEncoding],
		function* ({ answerMentions, callRpc, close, diagnosticLog, spanAttributes, wireAnswers }) {
			yield* callRpc("branched", { swap, value: "private branched contact" });

			yield* close();

			yield* outcomes({
				"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining({ left: "<redacted>", right: "<redacted>" }) } }],
				"diagnostic log": [
					diagnosticLog("branched diagnostic"),
					expect.objectContaining({ left: "<redacted>", right: "<redacted>", visible: "public control" }),
				],
				"leaked into the answer": [answerMentions("private branched contact"), []],
				"span attributes": [
					spanAttributes("branched"),
					[expect.objectContaining({ left: "<redacted>", right: "<redacted>", visible: "public control" })],
				],
			});
		},
	);
}

for (const source of ["schema", "host"] as const) {
	host.it(
		`a sensitive ${source} descendant that encodes as a scalar masks its enclosing field in the client failure, the diagnostic log and span attributes`,
		[json, scalarEncoding(source)],
		function* ({ answerMentions, callRpc, close, diagnosticLog, spanAttributes, wireAnswers }) {
			yield* callRpc("scalar", { value: "private scalar contact" });

			yield* close();

			yield* outcomes({
				"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining({ profile: "<redacted>", visible: "public control" }) } }],
				"diagnostic log": [diagnosticLog("scalar diagnostic"), expect.objectContaining({ profile: "<redacted>", visible: "public control" })],
				"leaked into the answer": [answerMentions("private scalar contact"), []],
				"span attributes": [spanAttributes("scalar"), [expect.objectContaining({ profile: "<redacted>", visible: "public control" })]],
			});
		},
	);
}
