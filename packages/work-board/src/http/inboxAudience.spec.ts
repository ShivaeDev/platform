import { Effect } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { inboxAudienceFixture } from "#test/inboxAudienceFixture.ts";

let notes: Folder;
let board: RunningBoard;

afterEach(() => {
	notes?.remove();
});

it.live.each([true, false])("filters managed=%s and registered questions without hiding other response paths", function* (managed) {
	notes = folder(inboxAudienceFixture("Casey", managed));
	board = yield* startBoard(notes.root, undefined, undefined, true, undefined, "Casey");
	const client = browserClient(board.url);
	try {
		for (const item of ["decision.reader", "decision.orchestrator"]) {
			const preview = yield* Effect.promise(() => client.run(client.responses.question.run({ item, request: "direction" })));
			const question = yield* Effect.promise(() =>
				client.mutate(client.responses.registerQuestion.run({ item, request: "direction", revision: preview.reviewedRevision })),
			);
			expect((yield* Effect.promise(() => client.run(client.responses.responses.run({ question: question.id })))).question.id).toBe(question.id);
		}
		const inbox = (yield* rawGet(board, "/_board/inbox")).body;
		expect(inbox).toContain("2 waiting");
		expect(inbox).toContain('aria-label="2 waiting">2</span>');
		const list = inbox.slice(inbox.indexOf('<section class="inbox-list"'));
		expect(list).toContain("Question for reader");
		expect(list).toContain("Where should the project documents live?");
		expect(list).not.toContain("Question for orchestrator");
		for (const path of [
			"/_board/item/decision.orchestrator/",
			"/_board/respond?item=decision.orchestrator&request=direction",
			"/_board/work?view=board",
			"/_board/work?view=table",
		]) {
			const response = yield* rawGet(board, path);
			expect(response.status).toBe(200);
			expect(response.body).toContain("Question for orchestrator");
			expect(response.body).toContain('id="inbox-topbar-count" class="inbox-count" aria-label="2 waiting">2</span>');
		}
	} finally {
		client.registry.dispose();
	}
});
