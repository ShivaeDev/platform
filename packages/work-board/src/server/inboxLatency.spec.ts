import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { indexClientSubscribed } from "#test/liveTraits.ts";
import { responseWorkspace } from "#test/responseWorkspace.ts";

const files = responseWorkspace(20);
const project = [projectFiles(files), responsesEnabled(), indexClientSubscribed];

boardStory.it(
	"a watched edit that turns an answer into not now puts its decision back in the Inbox and on the badge",
	project,
	function* ({ editFile, inboxDecisions, needsYouBadge, nextChange }) {
		expect(yield* inboxDecisions()).toEqual(["decision.fixture.19", "decision.fixture.9"]);

		editFile("responses/answer-0-current.md", files["responses/answer-0-current.md"]?.replace("type: answer", "type: not_now") ?? "");
		yield* nextChange();

		yield* outcomes([
			["the badge", () => needsYouBadge(), 3],
			["the Inbox", () => inboxDecisions(), ["decision.fixture.0", "decision.fixture.19", "decision.fixture.9"]],
		]);
	},
);
