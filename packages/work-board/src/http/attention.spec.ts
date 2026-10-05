import { renameSync } from "node:fs";
import { join } from "node:path";
import { Effect, PlatformError } from "effect";
import { afterEach, beforeEach, expect, it } from "vitest";
import { attentionFixture } from "#test/attentionFixture.ts";
import { changesUntil, type Folder, folder, type RunningBoard, rawGet, startBoard, subscribe } from "#test/board.ts";

let notes: Folder;
let board: RunningBoard;
beforeEach(async () => {
	notes = folder(attentionFixture());
	board = await startBoard(notes.root, "legacy.md");
});
afterEach(async () => {
	await board.stop();
	notes.remove();
});
function cards(body: string) {
	return [...body.matchAll(/data-attention-item="(?<item>[^"]+)" data-request="(?<request>[^"]+)"/gu)].map((match) => [
		match.groups?.item,
		match.groups?.request,
	]);
}

it("groups multiple explicit judgments and links their reason, recipients, targets and source context", async () => {
	const response = await rawGet(board, "/_board/overview");
	expect(response.status).toBe(200);
	expect(cards(response.body)).toEqual([
		["request.search", "matching-decision"],
		["request.search", "keyboard-review"],
		["request.fixture", "missing-fixture"],
	]);
	expect(response.body).toContain("3 validated open requests");
	expect(response.body).toContain("marvin, agent-navigation");
	expect(response.body).toContain("Review keyboard evidence before continuing.");
	expect(response.body).toContain('href="/_board/item/request.search/#attention-request-keyboard-review"');
	expect(response.body).toContain('href="/_board/item/work.search/#criterion-keyboard"');
	expect(response.body).toContain('href="/attention/review.md#attention-request-keyboard-review"');
	expect(cards(response.body).flat()).not.toContain("ordinary.review");
	expect(response.body).not.toContain("prior-review");
	const source = await rawGet(board, "/_board/item/request.search/");
	expect(source.body).toContain('id="attention-request-prior-review" tabindex="-1"');
	expect(source.body).toContain("closed");
	expect(source.body).toContain("does not establish acceptance or record an answer");
	expect((await rawGet(board, "/_board/item/work.search/")).body).toContain("Attention request");
	expect((await rawGet(board, "/_board/search?q=keyboard%20evidence%20marvin")).body).toContain("#attention-request-keyboard-review");
	expect((await rawGet(board, "/")).body).toContain('href="/_board/overview"');
});

it("keeps duplicate, missing-identity and unresolved criterion requests unclassified with readable diagnostics", async () => {
	const fixture = attentionFixture()["attention/review.md"] ?? "";
	notes.write("duplicate.md", fixture.replace("# Search judgments", "# Duplicate"));
	notes.write("attention/blocker.md", (attentionFixture()["attention/blocker.md"] ?? "").replace("work.search#keyboard", "work.search#missing"));
	const ambiguous = await rawGet(board, "/_board/overview");
	expect(cards(ambiguous.body)).toEqual([]);
	expect(ambiguous.body).toContain("Duplicate ID request.search");
	expect(ambiguous.body).toContain("Unresolved or duplicated criterion work.search#missing");
	expect(ambiguous.body).not.toContain("All quiet");
	expect(ambiguous.body).toContain('href="/duplicate.md"');
	notes.write("duplicate.md", "# Ordinary file");
	notes.write("attention/review.md", fixture.replace("id: request.search\n", ""));
	expect((await rawGet(board, "/_board/overview")).body).toContain("require an explicit item ID");
	notes.write("attention/review.md", fixture.replace("id: matching-decision", "id: keyboard-review"));
	const repeated = await rawGet(board, "/_board/overview");
	expect(cards(repeated.body)).toEqual([]);
	expect(repeated.body).toContain("Duplicate attention request ID keyboard-review");
	const physical = await rawGet(board, "/attention/review.md");
	expect(physical.body).toContain('id="attention-record-0"');
	expect(physical.body).not.toContain('id="attention-request-keyboard-review"');
});

it("shows malformed or invalid source issues and a genuine quiet state without inventing judgments", async () => {
	notes.write("attention/review.md", "---\nid: broken\nattention: [\n---\n# Still readable");
	notes.write(
		"attention/blocker.md",
		(attentionFixture()["attention/blocker.md"] ?? "").replace("response_from: [agent-navigation]", "response_from: []"),
	);
	const invalid = await rawGet(board, "/_board/overview");
	expect(cards(invalid.body)).toEqual([]);
	expect(invalid.body).toContain("Invalid attention");
	expect(invalid.body).toContain("attention/review.md");
	expect(invalid.body).not.toContain("All quiet");
	await board.stop();
	notes.remove();
	notes = folder({
		"closed.md": (attentionFixture()["attention/blocker.md"] ?? "")
			.replace("state: open", "state: closed")
			.replace("work.search#keyboard", "request.fixture"),
		"legacy.md": "# Home\n\n## In review\n\n### Please review\n",
		"plain.md": "# Agent finished",
	});
	board = await startBoard(notes.root, "legacy.md");
	const quiet = await rawGet(board, "/_board/overview");
	expect(quiet.body).toContain("All quiet — no explicit open requests recorded");
	expect(cards(quiet.body)).toEqual([]);
	expect((await rawGet(board, "/")).body).toContain("Please review");
});

it("rebuilds open requests after source edits, renames and restart without treating file churn as progress", async () => {
	const events = await subscribe(board);
	await events.next();
	try {
		notes.write("attention/review.md", (attentionFixture()["attention/review.md"] ?? "").replaceAll("state: open", "state: closed"));
		await changesUntil(events, "attention/review.md");
		expect(cards((await rawGet(board, "/_board/overview")).body)).toEqual([["request.fixture", "missing-fixture"]]);
		renameSync(join(notes.root, "attention/blocker.md"), join(notes.root, "attention/renamed & fixture.md"));
		await changesUntil(events, "attention/renamed & fixture.md");
		const renamed = await rawGet(board, "/_board/overview");
		expect(cards(renamed.body)).toEqual([["request.fixture", "missing-fixture"]]);
		expect(renamed.body).toContain('href="/attention/renamed%20%26%20fixture.md#attention-request-missing-fixture"');
	} finally {
		events.close();
	}
	await board.stop();
	board = await startBoard(notes.root, "legacy.md");
	expect(cards((await rawGet(board, "/_board/overview")).body)).toEqual([["request.fixture", "missing-fixture"]]);
});

it("withholds counts and classification on unreadable sources instead of claiming a quiet workspace", async () => {
	await board.stop();
	board = await startBoard(notes.root, "legacy.md", (fs) => ({
		...fs,
		readFileString: (file, options) =>
			file.endsWith("attention/review.md")
				? Effect.fail(PlatformError.systemError({ _tag: "PermissionDenied", method: "readFileString", module: "FileSystem" }))
				: fs.readFileString(file, options),
	}));
	const incomplete = await rawGet(board, "/_board/overview");
	expect(incomplete.status).toBe(503);
	expect(incomplete.body).toContain("Requests are not counted or classified");
	expect(incomplete.body).toContain("attention/review.md");
	expect(incomplete.body).not.toContain("validated open requests");
	expect(incomplete.body).not.toContain("All quiet");
	expect(cards(incomplete.body)).toEqual([]);
});
