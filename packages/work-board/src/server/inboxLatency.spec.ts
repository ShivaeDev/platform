import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { boardStory, projectFiles, responsesEnabled } from "#test/boardStory.ts";
import { indexClientSubscribed, recordParsingObserved } from "#test/liveTraits.ts";
import { responseWorkspace } from "#test/responseWorkspace.ts";

const files = responseWorkspace(20);
const project = [projectFiles(files), responsesEnabled(), recordParsingObserved, indexClientSubscribed];
const opened = ["decisions/decision-9.md", "document-1.md", "document-2.md"];

boardStory.it(
	"once the Inbox has read the response history, opening documents over HTTP and RPC parses no responses and only those documents' questions",
	project,
	function* ({ httpAnswer, inboxDecisions, parsedQuestions, parsedResponses, recordParsing, sourceOf }) {
		expect(yield* inboxDecisions()).toEqual(["decision.fixture.19", "decision.fixture.9"]);
		recordParsing();

		for (const file of opened) {
			yield* httpAnswer(`/${file}`);
			yield* sourceOf(file);
		}

		yield* outcomes({
			"parsed questions": [parsedQuestions(), opened],
			"parsed responses": [parsedResponses(), []],
		});
	},
);

boardStory.it(
	"a watched edit that turns an answer into not now puts its decision back in the Inbox and on the badge",
	project,
	function* ({ editFile, inboxDecisions, needsYouBadge, nextChange }) {
		expect(yield* inboxDecisions()).toEqual(["decision.fixture.19", "decision.fixture.9"]);

		editFile("responses/answer-0-current.md", files["responses/answer-0-current.md"]?.replace("type: answer", "type: not_now") ?? "");
		yield* nextChange();

		yield* outcomes({
			"the badge": [needsYouBadge(), 3],
			"the Inbox": [inboxDecisions(), ["decision.fixture.0", "decision.fixture.19", "decision.fixture.9"]],
		});
	},
);

boardStory.it(
	"after the Inbox has caught up with an answer edit, reading navigation parses no records again",
	project,
	function* ({ boardRead, editFile, inboxDecisions, nextChange, parsedQuestions, parsedResponses, recordParsing }) {
		expect(yield* inboxDecisions()).toEqual(["decision.fixture.19", "decision.fixture.9"]);
		editFile("responses/answer-0-current.md", files["responses/answer-0-current.md"]?.replace("type: answer", "type: not_now") ?? "");
		yield* nextChange();
		expect(yield* inboxDecisions()).toEqual(["decision.fixture.0", "decision.fixture.19", "decision.fixture.9"]);
		recordParsing();

		yield* boardRead("navigation");

		yield* outcomes({
			"parsed questions": [parsedQuestions(), []],
			"parsed responses": [parsedResponses(), []],
		});
	},
);
