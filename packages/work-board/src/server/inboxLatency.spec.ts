import { Effect } from "effect";
import { expect, vi } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#client/client.ts";
import * as records from "#server/responses/records.ts";
import { folder, startBoard } from "#test/board.ts";
import { waitFor } from "#test/live.ts";
import { responseWorkspace } from "#test/responseWorkspace.ts";

it.live("reuses validated response history across HTTP and RPC document opens and refreshes the Inbox after a watched answer edit", function* () {
	const files = responseWorkspace(20);
	const notes = yield* Effect.acquireRelease(
		Effect.sync(() => folder(files)),
		(value) => Effect.sync(value.remove),
	);
	const board = yield* startBoard(notes.root, undefined, undefined, true);
	const client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
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
		notes.write("responses/answer-0-current.md", files["responses/answer-0-current.md"]?.replace("type: answer", "type: not_now") ?? "");
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
});
