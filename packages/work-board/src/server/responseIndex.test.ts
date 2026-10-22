import { expect } from "vitest";
import { boardStory, projectFiles } from "#test/boardStory.ts";
import { responseWorkspace } from "#test/responseWorkspace.ts";

const files = responseWorkspace(2);
boardStory.it(
	"keeps old revisions, current answers, duplicate identities and malformed history distinct",
	[projectFiles(files)],
	function* ({ rpc, editFile, watchProject }) {
		const events = yield* watchProject();
		yield* events.next();
		expect((yield* rpc((client) => client("work-board.navigation", { current: "" }))).inboxCount).toBe(0);
		const current = files["responses/answer-0-current.md"];
		if (!current) {
			throw new Error("The response fixture has no current answer");
		}
		editFile("responses/answer-0-current.md", current.replace("type: answer", "type: not_now"));
		yield* events.changed("responses/answer-0-current.md");
		expect((yield* rpc((client) => client("work-board.navigation", { current: "" }))).inboxCount).toBe(1);
		editFile("responses/duplicate.md", current);
		yield* events.changed("responses/duplicate.md");
		const duplicate = yield* rpc((client) => client("work-board.document", { url: "/decisions/decision-0.md" }));
		expect(duplicate.requests[0]?.unavailable).toContain("ambiguous");
		editFile("responses/broken.md", "---\nresponse: {}\n---\n# Broken");
		yield* events.changed("responses/broken.md");
		expect((yield* rpc((client) => client("work-board.navigation", { current: "" }))).inboxCount).toBe(2);
	},
);
