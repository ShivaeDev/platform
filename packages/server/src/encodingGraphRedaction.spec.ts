import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { declarationOrder, flattenedEncoding, unionEncoding } from "#test/app-host/encodingGraph.ts";
import { host } from "#test/app-host/story.ts";
import { collector } from "#test/app-host/telemetry.ts";

const json = collector({ env: { "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json" } });

for (const [key, value] of [
	["wireContact", "private contact"],
	["alternateContact", "alternate private contact"],
] as const) {
	host.it(
		`the ${key} branch of an encoded union failure reaches the client masked`,
		[unionEncoding],
		function* ({ answerMentions, callRpc, wireAnswers }) {
			yield* callRpc("unionFailure", { value });

			yield* outcomes({
				"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining({ [key]: "<redacted>" }) } }],
				"leaked into the answer": [answerMentions(value), []],
			});
		},
	);
}

for (const declaration of ["schema", "host"] as const) {
	host.it(
		`flattened descendants declared sensitive by the ${declaration} are masked in the client failure, the diagnostic log and span attributes`,
		[json, flattenedEncoding(declaration)],
		function* ({ answerMentions, callRpc, close, diagnosticLog, spanAttributes, wireAnswers }) {
			yield* callRpc("flattened", { value: "private nested contact" });

			yield* close();

			yield* outcomes({
				"client answer": [wireAnswers(), { "1": { failed: expect.objectContaining({ wireContact: "<redacted>", wireVisible: "<redacted>" }) } }],
				"diagnostic log": [
					diagnosticLog("flattened diagnostic"),
					expect.objectContaining({ visible: "public detail", wireContact: "<redacted>", wireVisible: "<redacted>" }),
				],
				"leaked into the answer": [answerMentions("private nested contact"), []],
				"span attributes": [
					spanAttributes("flattened"),
					[expect.objectContaining({ visible: "public detail", wireContact: "<redacted>", wireVisible: "<redacted>" })],
				],
			});
		},
	);
}

for (const order of ["first", "last"] as const) {
	host.it(
		`with the sensitive declaration ${order}, directly and chained encoded names are masked in client failures, the diagnostic log and span attributes`,
		[json, declarationOrder(order)],
		function* ({ answerMentions, callRpcs, close, diagnosticLog, spanAttributes, wireAnswers }) {
			yield* callRpcs([
				{ id: "mapped", payload: { value: "private ordered contact" }, tag: "mapped" },
				{ id: "lastLink", payload: { value: "private ordered contact" }, tag: "lastLink" },
			]);

			yield* close();

			yield* outcomes({
				"client answers": [
					wireAnswers(),
					{
						lastLink: { failed: expect.objectContaining({ visible: "<redacted>", wireChainedContact: "<redacted>" }) },
						mapped: { failed: expect.objectContaining({ visible: "<redacted>", wireContact: "<redacted>" }) },
					},
				],
				"diagnostic log": [
					diagnosticLog("mapping diagnostic"),
					expect.objectContaining({
						contact: "<redacted>",
						control: "public control",
						intermediateContact: "<redacted>",
						visible: "<redacted>",
						wireChainedContact: "<redacted>",
						wireContact: "<redacted>",
					}),
				],
				"leaked into the answers": [answerMentions("private ordered contact"), []],
				"span attributes": [
					spanAttributes("mapped"),
					[
						expect.objectContaining({
							control: "public control",
							visible: "<redacted>",
							wireChainedContact: "<redacted>",
							wireContact: "<redacted>",
						}),
					],
				],
			});
		},
	);
}
