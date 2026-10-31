import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { questionId, responseMarkdown, revisionOf } from "#server/responses/records.ts";
import { decisionFile, decisionId, readyDecisionFixture } from "#test/answerCardFixture.ts";
import { answeredDecisionFixture } from "#test/answeredDecisionFixture.ts";
import { closedDecision, unansweredDecision } from "#test/itemHeaderFixture.ts";
import { reviewedDecisionId, reviewedWorkFixture } from "#test/reviewedWorkFixture.ts";
import { screenStory } from "#test/screenStory.ts";
import { routedScreen } from "#test/screenTraits.ts";

expectNoReactWarnings();

const url = `/_board/item/${decisionId}/`;
const TITLE = "Fleet decision: Publish the install guide";
const AUTHORED = {
	"home.md": "# Home",
	"seven.md": `---\n${JSON.stringify({
		attention: [{ id: "design", kind: "decision", reason: "These choices are yours.", "response_from": ["maintainer"], state: "closed" }],
		id: "decision.seven",
		kind: "question",
		scope: "task",
		status: "done",
		urgency: "whenever",
	})}\n---\n# Seven design questions\n\nThe choices where a maintainer could go either way.\n`,
};
const question = questionId(decisionId, "direction", revisionOf(readyDecisionFixture[decisionFile] ?? ""), decisionFile);
const competing = {
	...closedDecision(answeredDecisionFixture()),
	"responses/response.direction-release.md": responseMarkdown({
		body: "Stop and hand back",
		id: "response.direction-release",
		response: {
			answers: [{ prompt: "fleet-action", selected: ["release"], text: "Hand it back before the release." }],
			author: "orchestrator",
			question,
			recordedAt: 3000,
			reviewedRevision: revisionOf(readyDecisionFixture[decisionFile] ?? ""),
			type: "answer",
		},
	}),
};
const quietPacket = Object.fromEntries(
	Object.entries(reviewedWorkFixture()).map(([file, source]) => [
		file,
		file.startsWith("responses/")
			? source.replace('"state":"open"', '"state":"closed"').replace("<https://github.com/example/project/pull/12>", "")
			: source,
	]),
);

screenStory.it(
	"a closed Fleet decision leads its document with an Outcome naming the recorded choice, who chose it, when, and the answer file",
	[routedScreen(closedDecision(answeredDecisionFixture()), url, { home: "home.md" })],
	function* ({ decisionOutcome }) {
		expect(yield* decisionOutcome()).toEqual({
			answers: [{ at: 2000, by: "maintainer", choice: "Request changes", file: "/responses/response.direction-retry.md", notes: [] }],
			heading: "Outcome",
			leadsDocument: true,
			message: "none",
		});
	},
);

screenStory.it(
	"a closed Fleet decision is titled after the work it unblocks, on the page and in the browser title",
	[routedScreen(closedDecision(answeredDecisionFixture()), url, { home: "home.md" })],
	function* ({ itemHeading, readTitle }) {
		yield* outcomes({
			"browser title": [readTitle(), expect.stringContaining(TITLE)],
			heading: [itemHeading(), TITLE],
		});
	},
);

screenStory.it(
	"competing answers each show in the Outcome with their author's choice and note",
	[routedScreen(competing, url, { home: "home.md" })],
	function* ({ decisionOutcome }) {
		expect(yield* decisionOutcome()).toEqual(
			expect.objectContaining({
				answers: [
					expect.objectContaining({ by: "maintainer", choice: "Request changes", notes: [] }),
					expect.objectContaining({ by: "orchestrator", choice: "Stop and hand back", notes: ["Hand it back before the release."] }),
				],
			}),
		);
	},
);

screenStory.it(
	"a decision closed without an answer says so plainly at the top of its document",
	[routedScreen(AUTHORED, "/_board/item/decision.seven/", { home: "home.md" })],
	function* ({ decisionOutcome }) {
		expect(yield* decisionOutcome()).toEqual({
			answers: [],
			heading: "Outcome",
			leadsDocument: true,
			message: "Closed with no answer recorded on the Board.",
		});
	},
);

screenStory.it(
	"a decision still waiting for its answer shows its answer card and no Outcome",
	[routedScreen(unansweredDecision(), url, { home: "home.md" })],
	function* ({ cardTitle, decisionOutcome }) {
		yield* outcomes({
			"answer card": [cardTitle(), "Answer: Publish the install guide"],
			outcome: [decisionOutcome(), "none"],
		});
	},
);

screenStory.it(
	"a closed Fleet packet leaves out its empty sections",
	[routedScreen(quietPacket, `/_board/item/${reviewedDecisionId}/`, { home: "tasks/upload.md" })],
	function* ({ documentSections }) {
		expect(yield* documentSections()).toEqual(["Outcome", "Decision", "Recommendation", "Reviewed Board work"]);
	},
);

screenStory.it(
	"a Fleet packet shows its fenced decision and recommendation as plain wrapping text, not code",
	[routedScreen(quietPacket, `/_board/item/${reviewedDecisionId}/`, { home: "tasks/upload.md" })],
	function* ({ documentFences }) {
		expect(yield* documentFences()).toEqual(["Reviewed PR is ready to merge (plain text)", "Merge the reviewed PR (plain text)"]);
	},
);
