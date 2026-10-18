import { Effect } from "effect";
import { expect, vi } from "vitest";
import * as records from "#server/responses/records.ts";
import { boardStory, deferredServing, projectFiles } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";
import { responseWorkspace } from "#test/responseWorkspace.ts";

boardStory.it(
	"reuses validated response history across HTTP and RPC document opens and refreshes the Inbox after a watched answer edit",
	[projectFiles(responseWorkspace(20)), deferredServing],
	function* ({ start, editFile, connectClient }) {
		const files = responseWorkspace(20);
		const board = yield* start({ responses: true });
		const client = connectClient();
		expect((yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "" })))).inboxCount).toBe(2);
		const responses = vi.spyOn(records, "responseFrom");
		const questions = vi.spyOn(records, "questionFrom");
		try {
			for (const file of ["document-1.md", "document-2.md", "decisions/decision-9.md"]) {
				const page = yield* Effect.promise(() => fetch(`${board.url}/${file}`));
				expect(page.status).toBe(200);
				expect(yield* Effect.promise(() => page.text())).toContain("data-board-react-root");
				const content = yield* Effect.promise(() => client.run(client.api.document.run({ url: `/${file}` })));
				expect(content.file).toBe(file);
			}
			expect(responses).not.toHaveBeenCalled();
			expect(new Set(questions.mock.calls.map(([source]) => source.file))).toEqual(
				new Set(["document-1.md", "document-2.md", "decisions/decision-9.md"]),
			);
			editFile("responses/answer-0-current.md", files["responses/answer-0-current.md"]?.replace("type: answer", "type: not_now") ?? "");
			yield* Effect.promise(() => waitFor(async () => expect((await client.run(client.api.navigation.run({ current: "" }))).inboxCount).toBe(3)));
			responses.mockClear();
			questions.mockClear();
			expect((yield* Effect.promise(() => client.run(client.api.navigation.run({ current: "document-1.md" })))).inboxCount).toBe(3);
			expect(responses).not.toHaveBeenCalled();
			expect(questions).not.toHaveBeenCalled();
		} finally {
			responses.mockRestore();
			questions.mockRestore();
		}
	},
);
