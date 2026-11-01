import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { indexClientSubscribed } from "#test/liveTraits.ts";
import { responseWorkspace } from "#test/responseWorkspace.ts";

const files = responseWorkspace(2);
const current = files["responses/answer-0-current.md"] ?? "";
const project = [projectFiles(files), indexClientSubscribed];

boardStory.it(
	"changing the current answer to not now brings its decision back to the Inbox, while older answers to earlier revisions do not count",
	project,
	function* ({ editFile, inboxDecisions, needsYouBadge, nextChange }) {
		expect(yield* needsYouBadge()).toBe(0);

		editFile("responses/answer-0-current.md", current.replace("type: answer", "type: not_now"));
		yield* nextChange();

		const reopened = ["decision.fixture.0"];
		yield* outcomes([
			["reopened decisions", () => inboxDecisions(), reopened],
			["Inbox badge", () => needsYouBadge(), reopened.length],
		]);
	},
);

boardStory.it(
	"a second response file with the same identity makes the decision's request unanswerable as ambiguous",
	project,
	function* ({ editFile, nextChange, requestStates }) {
		expect(yield* requestStates("decisions/decision-0.md")).toEqual(["answerable"]);

		editFile("responses/duplicate.md", current);
		yield* nextChange();

		expect(yield* requestStates("decisions/decision-0.md")).toEqual([expect.stringContaining("ambiguous")]);
	},
);

boardStory.it(
	"a malformed response record brings every answered decision back to the Inbox",
	project,
	function* ({ editFile, inboxDecisions, nextChange }) {
		expect(yield* inboxDecisions()).toEqual([]);

		editFile("responses/broken.md", "---\nresponse: {}\n---\n# Broken");
		yield* nextChange();

		expect(yield* inboxDecisions()).toEqual(["decision.fixture.0", "decision.fixture.1"]);
	},
);
