import { expect } from "vitest";
import { documentedSourceStory, sourceExample } from "#test/documentedSourceStory.ts";

const DELIVERY = "docs/delivery/";
const claims = [
	[
		"README.md",
		2,
		{
			attention: [{ id: "keyboard-review", kind: "review", responseFrom: ["maintainer"], state: "open", unblocks: ["work.search#keyboard"] }],
			criteria: [{ id: "keyboard" }],
		},
	],
	["README.md", 3, { id: "board.review", items: ["work.search"] }],
	[
		"README.md",
		4,
		{
			evidence: [{ criterion: "work.search#keyboard", method: "DOM regression", outcome: "passed", source: "evidence.md" }],
			relationships: [{ kind: "implements", target: "work.search" }],
		},
	],
	[
		"README.md",
		6,
		{
			kind: "question",
			options: [{ label: "Keep local files" }, { label: "Use a database" }],
			recommended: "Keep local files",
			scope: "task",
			urgency: "whenever",
		},
	],
	[
		`${DELIVERY}attention-examples.md`,
		1,
		{
			attention: [
				{ id: "keyboard-review", kind: "review", responseFrom: ["maintainer"], unblocks: ["work.search#keyboard"] },
				{ id: "matching-decision", kind: "decision", responseFrom: ["maintainer"], unblocks: ["decision.search-matching"] },
			],
		},
	],
	[
		`${DELIVERY}attention-examples.md`,
		2,
		{ attention: [{ id: "missing-fixture", kind: "blocker", responseFrom: ["agent-navigation"], unblocks: ["work.search#keyboard"] }] },
	],
	[
		`${DELIVERY}decision-write-examples.md`,
		1,
		{ attention: [{ id: "experience", kind: "decision", state: "open", unblocks: ["review.direction"] }] },
	],
	[`${DELIVERY}result-review-examples.md`, 1, { criteria: [{ id: "focus" }, { id: "narrow" }], status: "ready" }],
	[
		`${DELIVERY}result-review-examples.md`,
		2,
		{
			attention: [{ id: "review", kind: "review", state: "open", unblocks: ["work.keyboard"] }],
			kind: "report",
			relationships: [{ kind: "implements", target: "work.keyboard" }],
			status: "done",
		},
	],
	[
		`${DELIVERY}source-examples.md`,
		2,
		{ criteria: [{ id: "keyboard" }, { id: "passage" }], relationships: [{ kind: "implements", target: "decision.search-matching" }] },
	],
	[`${DELIVERY}source-examples.md`, 3, { kind: "question", relationships: [{ kind: "informs", target: "work.search" }] }],
	[`${DELIVERY}source-examples.md`, 4, { items: ["work.search", "work.reading-state"] }],
	[
		`${DELIVERY}source-examples.md`,
		5,
		{
			evidence: [
				{ criterion: "work.search#keyboard", method: "real Chromium walkthrough", outcome: "passed", source: "../evidence/browser-walkthrough.md" },
			],
		},
	],
] as const;

for (const [document, number, fields] of claims) {
	documentedSourceStory.it(
		`${document} example ${number} carries its declared work records`,
		[sourceExample(document, number)],
		function* ({ metadata }) {
			expect((yield* metadata()).fields).toMatchObject(fields);
		},
	);
}
