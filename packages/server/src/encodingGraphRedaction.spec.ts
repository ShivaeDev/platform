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
		`a sensitive declaration registered ${order} leaves other RPCs' encoded failure fields public`,
		[declarationOrder(order)],
		function* ({ callRpcs, wireAnswers }) {
			yield* callRpcs([
				{ id: "mapped", payload: { value: "public ordered contact" }, tag: "mapped" },
				{ id: "lastLink", payload: { value: "public ordered contact" }, tag: "lastLink" },
				{ id: "firstLink", payload: { value: "public ordered contact" }, tag: "firstLink" },
			]);

			expect(yield* wireAnswers()).toEqual({
				firstLink: { failed: { intermediateContact: "public ordered contact" } },
				lastLink: { failed: { visible: "public detail", wireChainedContact: "public ordered contact" } },
				mapped: { failed: { visible: "public detail", wireContact: "public ordered contact" } },
			});
		},
	);
}
