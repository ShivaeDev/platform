import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { rootDefect, rootEncoding } from "#test/app-host/rootEncoding.ts";
import { host } from "#test/app-host/story.ts";

for (const source of ["schema", "host"] as const) {
	for (const shape of ["scalar", "record"] as const) {
		host.it(
			`a sensitive ${source} failure encoded as a root ${shape} is masked while a public failure and a success in the same batch stay intact`,
			[rootEncoding(source, shape)],
			function* ({ answerMentions, callRpcs, wireAnswers }) {
				yield* callRpcs([
					{ id: "1", payload: { contact: "private root contact", slot: "runtimeChosenField" }, tag: "hidden" },
					{ id: "2", payload: { detail: "public rejection" }, tag: "visibleFailure" },
					{ id: "3", payload: { contact: "successful application value" }, tag: "succeed" },
				]);

				yield* outcomes({
					"client answers": [
						wireAnswers(),
						{
							"1": { failed: "<redacted>" },
							"2": { failed: expect.objectContaining({ detail: "public rejection" }) },
							"3": { succeeded: "successful application value" },
						},
					],
					"leaked into the answers": [answerMentions("private root contact"), []],
				});
			},
		);
	}
}

for (const [interrupt, answer] of [
	[false, { connection: { "connection defect": "<redacted>" } }],
	[true, { "1": [{ died: "<redacted>" }, "interrupted"] }],
] as const) {
	host.it(
		`a sensitive defect root is masked in ${interrupt ? "the request's exit cause beside its interruption" : "the connection defect"}`,
		[rootDefect],
		function* ({ answerMentions, callRpc, wireAnswers }) {
			yield* callRpc("hiddenDefect", { interrupt, value: "private root defect" });

			yield* outcomes({
				"client answer": [wireAnswers(), answer],
				"leaked into the answer": [answerMentions("private root defect"), []],
			});
		},
	);
}

host.it(
	"a public failure reusing a request ID cannot replace the sensitive failure's schema policy",
	[rootEncoding("schema", "scalar")],
	function* ({ answerMentions, callRpcs, wireAnswers }) {
		yield* callRpcs([
			{ id: "1", payload: { contact: "private repeated request contact", slot: "unused" }, tag: "hidden" },
			{ id: "1", payload: { detail: "public rejection" }, tag: "visibleFailure" },
		]);

		yield* outcomes({
			"client answers": [wireAnswers(), { "1": expect.arrayContaining([{ failed: "<redacted>" }]) }],
			"leaked into the answers": [answerMentions("private repeated request contact"), []],
		});
	},
);

host.it(
	"a numeric request ID keeps the sensitive root policy",
	[rootEncoding("schema", "scalar")],
	function* ({ answerMentions, callRpcs, wireAnswers }) {
		yield* callRpcs([{ id: 1, payload: { contact: "private numeric request contact", slot: "unused" }, tag: "hidden" }]);

		yield* outcomes({
			"client answer": [wireAnswers(), { "1": { failed: "<redacted>" } }],
			"leaked into the answer": [answerMentions("private numeric request contact"), []],
		});
	},
);
