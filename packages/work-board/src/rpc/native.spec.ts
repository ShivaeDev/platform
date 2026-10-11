import { Effect, Stream } from "effect";
import { afterEach, expect } from "vitest";
import { it } from "@shivaedev/effect-test/it.ts";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, rawPost, startBoard } from "#test/board.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;

afterEach(() => {
	client?.registry.dispose();
	notes?.remove();
});

const open = Effect.fn("Test.open")(function* () {
	notes = folder({ "nested/home.md": "# Home", "note.md": "---\nid: note\n---\n# Note\n\nRead this.", "other.md": "# Other" });
	board = yield* startBoard(notes.root, "nested/home.md");
	client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(value) => Effect.sync(() => value.registry.dispose()),
	);
	yield* Effect.promise(() => waitFor(() => expect(client.registry.get(client.updates.status).connection).toBe("live")));
});

it.live("reads SSR documents, stable item URLs, navigation, search and explicit history through native HTTP RPC", function* () {
	yield* open();
	const page = yield* Effect.promise(() => client.read(client.api.page.query({ url: "/_board/item/note/" })));
	expect(page.html).toContain("Read this.");
	expect(page.status).toBe(200);
	expect((yield* Effect.promise(() => client.read(client.api.navigation.query({ current: "note.md" })))).tree.files).toEqual(
		expect.arrayContaining([expect.objectContaining({ current: true, href: "/note.md" })]),
	);
	expect((yield* Effect.promise(() => client.read(client.api.search.query({ query: "Read this" })))).results).toEqual(
		expect.arrayContaining([expect.objectContaining({ file: "note.md", kind: "passage" })]),
	);
	const seen = yield* Effect.promise(() => client.run(client.api.history.run({ action: "observe", baseline: null })));
	expect(seen.snapshot).toContain("Read this.");
	expect((yield* Effect.promise(() => fetch(`${board.url}/note.md`))).status).toBe(200);
	expect((yield* Effect.promise(() => fetch(`${board.url}/_board/native.js`))).headers.get("content-type")).toContain("javascript");
	const boardUrl = board.url;
	for (const [asset, type] of [
		["react.js", "text/javascript"],
		["react.css", "text/css"],
	]) {
		const response = yield* Effect.promise(() => fetch(`${boardUrl}/_board/${asset}`));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe(type);
		expect(yield* Effect.promise(() => response.text())).not.toBe("");
	}
});

it.live("retains unrelated mounted reads while reconciling dependent pages and navigation after source changes", function* () {
	yield* open();
	const atom = client.api.page.query({ url: "/note.md" });
	const release = client.registry.mount(atom);
	const initial = yield* Effect.promise(() => client.read(atom));
	const nav = client.api.navigation.query({ current: "note.md" });
	const releaseNav = client.registry.mount(nav);
	const oldNav = yield* Effect.promise(() => client.read(nav));
	notes.write("other.md", "# Updated unrelated");
	yield* Effect.promise(() =>
		waitFor(() => {
			const result = client.registry.get(nav);
			expect(result._tag === "Success" && result.value !== oldNav).toBe(true);
		}),
	);
	expect(yield* Effect.promise(() => client.read(atom))).toBe(initial);
	notes.write("note.md", "---\nid: note\n---\n# Changed note");
	yield* Effect.promise(() =>
		waitFor(() => {
			const read = client.registry.get(atom);
			expect(read._tag === "Success" && read.value.html.includes("Changed note")).toBe(true);
		}),
	);
	release();
	releaseNav();
});

it.live("enforces same-origin and loopback guards at the native route", function* () {
	yield* open();
	const blocked = yield* Effect.promise(() =>
		fetch(`${board.url}/_board/rpc`, { body: "", headers: { origin: "https://remote.example" }, method: "POST" }),
	);
	expect(blocked.status).toBe(403);
	const rebound = yield* rawPost(board, "/_board/rpc", { host: "remote.example" });
	expect(rebound.status).toBe(403);
});

it.live("requires the RPC content type even with responses disabled", function* () {
	yield* open();
	const blocked = yield* rawPost(board, "/_board/rpc", { "content-type": "application/json", origin: board.url });
	expect(blocked.status).toBe(403);
});

it.live("interrupts an active native subscription when the HTTP server scope ends", function* () {
	yield* open();
	yield* Effect.promise(() => client.read(client.api.page.query({ url: "/note.md" })));
	yield* board.stop();
	yield* Effect.promise(() => waitFor(() => expect(client.registry.get(client.updates.status).connection).toBe("reconnecting")));
});

it.live("reads getting-started templates through the shared native page contract", function* () {
	yield* open();
	const page = yield* Effect.promise(() => client.read(client.api.page.query({ url: "/_board/start" })));
	expect(page.status).toBe(200);
	expect(page.html).toContain("Project and report templates");
	expect(page.html).toContain('data-view="start"');
	expect(page.html).toContain("example.result");
});

it.live("delivers the initial reconciliation hint through the bound Board subscription", function* () {
	yield* open();
	const hints = yield* Effect.promise(() => client.run(Stream.runCollect(client.api.subscribe.run(undefined).pipe(Stream.take(1)))));
	expect(hints).toEqual([{ _tag: "Resync" }]);
});
