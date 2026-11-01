import { expect } from "vitest";
import { revisionOf } from "#server/responses/records.ts";
import { documentation } from "#test/documentedExamples.ts";
import { documentedSourceStory, sourceExample } from "#test/documentedSourceStory.ts";
import { metadataParse } from "./parse.ts";

const DELIVERY = "docs/delivery/";

for (const [document, number, request, prompts] of [
	["README.md", 6, "", [["answer", "one", ["option-1", "option-2"]]]],
	["README.md", 7, "keyboard-review", [["display", "one", ["latest", "history"]]]],
	[
		`${DELIVERY}decision-write-examples.md`,
		1,
		"experience",
		[
			["display", "one", ["latest", "history"]],
			["checks", "many", ["back", "reload"]],
			["next", "text", []],
		],
	],
	[`${DELIVERY}result-review-examples.md`, 2, "review", [["verdict", "one", ["revision", "accept"]]]],
] as const) {
	documentedSourceStory.it(
		`${document} example ${number} supplies its declared question choices`,
		[sourceExample(document, number)],
		function* ({ packet }) {
			expect((yield* packet(request)).prompts.map((prompt) => [prompt.id, prompt.mode, prompt.options.map((option) => option.id)])).toEqual(prompts);
		},
	);
}

for (const [document, number, visuals] of [
	["README.md", 5, ["progress"]],
	[`${DELIVERY}visual-document-examples.md`, 1, ["metric", "metric"]],
	[`${DELIVERY}visual-document-examples.md`, 2, ["progress"]],
	[`${DELIVERY}visual-document-examples.md`, 3, ["timeline"]],
] as const) {
	documentedSourceStory.it(
		`${document} example ${number} renders its declared visual components`,
		[sourceExample(document, number)],
		function* ({ rendered }) {
			expect((yield* rendered()).visuals).toEqual(visuals);
		},
	);
}

documentedSourceStory.it(
	"the handoff example captures a complete task and hashes its exact source bytes",
	[sourceExample(`${DELIVERY}handoff-examples.md`, 1)],
	function* ({ metadata }) {
		const parsed = yield* metadata();
		expect(parsed.fields.handoff).toMatchObject({
			item: "work.search",
			recipient: "agent-navigation",
			reviewedRevision: revisionOf(parsed.body),
			source: "items/search.md",
			state: "requested",
		});
		const source = metadataParse(parsed.body);
		expect(source.diagnostics).toEqual([]);
		expect(source.fields).toMatchObject({ criteria: [{ id: "focus" }], id: "work.search", kind: "task" });
	},
);

documentedSourceStory.it(
	"the literal receipt edit acknowledges the documented handoff without changing its direction",
	[sourceExample(`${DELIVERY}handoff-examples.md`, 2)],
	function* ({ metadata }) {
		expect((yield* metadata()).fields.handoff).toMatchObject({
			by: "agent-navigation",
			goal: "Fix keyboard focus",
			item: "work.search",
			note: "Received; execution has not started.",
			state: "acknowledged",
		});
	},
);

documentedSourceStory.it(
	"the report's documented wait revision matches its full literal source and supplies no criterion evidence",
	[sourceExample(`${DELIVERY}result-review-examples.md`, 2)],
	function* ({ metadata }) {
		const parsed = yield* metadata();
		expect(parsed.fields.evidence).toBeUndefined();
		const revision = revisionOf((parsed.raw ?? "") + parsed.body);
		const hashes = [...documentation(`${DELIVERY}result-review-examples.md`).matchAll(/[a-f\d]{64}/gu)].map(([hash]) => hash);
		expect(hashes).toEqual([revision, revision]);
	},
);
