import { Effect, PlatformError } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#client/client.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { syntheticSources } from "#test/diagnostics.ts";
import { inboxFixture } from "#test/inboxFixture.ts";

let notes: Folder;
let board: RunningBoard;

afterEach(() => {
	notes?.remove();
});

it.live("renders unknown Inbox counts when a source cannot be indexed", function* () {
	notes = folder(inboxFixture());
	board = yield* startBoard(notes.root, undefined, (fs) => ({
		...fs,
		readFileString: (file, options) =>
			file.endsWith("question.md")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
				: fs.readFileString(file, options),
	}));
	for (const path of ["/owner.md", "/_board/inbox", "/_board/overview"]) {
		const response = yield* rawGet(board, path);
		expect(response.body).toContain('id="inbox-count" class="inbox-count" aria-label="? waiting">?</span>');
		expect(response.body).toContain('id="inbox-topbar-count" class="inbox-count" aria-label="? waiting">?</span>');
	}
});

it.live("counts registered questions on ordinary attention sources without counting the captured copy twice", function* () {
	const source = inboxFixture()["responses/decision.md"]?.replace("managed: true", "managed: false") ?? "";
	notes = folder({ "decision.md": source, "fleet.md": "---\nid: task.fleet\n---\n# Work\n" });
	board = yield* startBoard(notes.root, undefined, (fs) => fs, true);
	const client = browserClient(board.url);
	try {
		const preview = yield* Effect.promise(() => client.run(client.responses.question.run({ item: "decision.delivery", request: "delivery" })));
		const question = yield* Effect.promise(() =>
			client.mutate(client.responses.registerQuestion.run({ item: preview.item, request: preview.request, revision: preview.reviewedRevision })),
		);
		expect((yield* rawGet(board, "/_board/inbox")).body).toContain("1 waiting");
		yield* Effect.promise(() =>
			client.mutate(
				client.responses.recordResponse.run({
					author: "Casey",
					body: "Proceed with local delivery",
					id: "response.delivery",
					question: question.id,
					type: "answer",
				}),
			),
		);
		expect((yield* rawGet(board, "/_board/inbox")).body).toContain("0 waiting");
	} finally {
		client.registry.dispose();
	}
});

it.live("serves the Inbox count on reader pages and exposes waiting work in Overview, cards and tables", function* () {
	notes = folder(inboxFixture());
	board = yield* startBoard(notes.root, undefined, undefined, false, syntheticSources());
	for (const path of [
		"/_board/inbox",
		"/question.md",
		"/_board/work?view=board",
		"/_board/overview",
		"/_board/changes",
		"/_board/start",
		"/_board/diagnostics",
	]) {
		const response = yield* rawGet(board, path);
		expect(response.status).toBe(200);
		expect(response.body).toContain('id="inbox-count" class="inbox-count" aria-label="3 waiting">3</span>');
	}
	const inbox = (yield* rawGet(board, "/_board/inbox")).body;
	expect(inbox).toContain("3 waiting");
	expect(inbox).toContain('id="inbox-topbar-count" class="inbox-count" aria-label="3 waiting">3</span>');
	expect(inbox).toContain("Review keyboard behavior");
	expect(inbox).toContain('data-modified="');
	for (const path of ["/_board/overview", "/_board/work?view=board", "/_board/work?view=table"]) {
		const view = (yield* rawGet(board, path)).body;
		const attention = path === "/_board/work?view=board" ? 'data-status-token="needs-you"' : "Waiting on you";
		expect(view).toContain(path === "/_board/overview" ? "Open Inbox" : attention);
		expect(view).not.toContain("All quiet");
	}
	const question = (yield* rawGet(board, "/question.md")).body;
	expect(question).toContain("Keep local files · Recommended");
	expect(question).toContain('data-choice="option-1"');
	expect(question).toContain("Read-only. Restart with --responses to enable answers.");
	expect(question).toContain('href="/_board/library"');
	expect(question).not.toContain('<details data-key="fleet-records">');
});
