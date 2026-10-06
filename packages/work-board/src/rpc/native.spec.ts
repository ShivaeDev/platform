import { afterEach, expect, it } from "vitest";
import { browserClient } from "#browser/client.ts";
import { type Folder, folder, type RunningBoard, rawPost, startBoard } from "#test/board.ts";
import { waitFor } from "#test/live.ts";

let notes: Folder;
let board: RunningBoard;
let client: ReturnType<typeof browserClient>;
afterEach(async () => {
	client?.registry.dispose();
	await board?.stop();
	notes?.remove();
});
async function open() {
	notes = folder({ "nested/home.md": "# Home", "note.md": "---\nid: note\n---\n# Note\n\nRead this.", "other.md": "# Other" });
	board = await startBoard(notes.root, "nested/home.md");
	client = browserClient(board.url);
	await waitFor(() => expect(client.registry.get(client.updates.status).connection).toBe("live"));
}
it("reads SSR documents, stable item URLs, navigation, search and explicit history through native HTTP RPC", async () => {
	await open();
	const page = await client.read(client.api.page.query({ url: "/_board/item/note/" }));
	expect(page.html).toContain("Read this.");
	expect(page.status).toBe(200);
	expect(await client.read(client.api.navigation.query())).toContain("/note.md");
	expect((await client.read(client.api.search.query({ query: "Read this" }))).results).toEqual(
		expect.arrayContaining([expect.objectContaining({ file: "note.md", kind: "passage" })]),
	);
	const seen = await client.run(client.api.history.run({ action: "observe", baseline: null }));
	expect(seen.snapshot).toContain("Read this.");
	expect((await fetch(`${board.url}/note.md`)).status).toBe(200);
	expect((await fetch(`${board.url}/_board/native.js`)).headers.get("content-type")).toContain("javascript");
});
it("retains unrelated mounted reads while reconciling dependent pages and navigation after source changes", async () => {
	await open();
	const atom = client.api.page.query({ url: "/note.md" });
	const release = client.registry.mount(atom);
	const initial = await client.read(atom);
	const nav = client.api.navigation.query();
	const releaseNav = client.registry.mount(nav);
	const oldNav = await client.read(nav);
	notes.write("other.md", "# Updated unrelated");
	await waitFor(() => {
		const result = client.registry.get(nav);
		expect(result._tag === "Success" && result.value !== oldNav).toBe(true);
	});
	expect(await client.read(atom)).toBe(initial);
	notes.write("note.md", "---\nid: note\n---\n# Changed note");
	await waitFor(() => {
		const read = client.registry.get(atom);
		expect(read._tag === "Success" && read.value.html.includes("Changed note")).toBe(true);
	});
	release();
	releaseNav();
});
it("enforces same-origin and loopback guards at the native route", async () => {
	await open();
	const blocked = await fetch(`${board.url}/_board/rpc`, { body: "", headers: { origin: "https://remote.example" }, method: "POST" });
	expect(blocked.status).toBe(403);
	const rebound = await rawPost(board, "/_board/rpc", { host: "remote.example" });
	expect(rebound.status).toBe(403);
});
it("interrupts an active native subscription when the HTTP server scope ends", async () => {
	await open();
	await client.read(client.api.page.query({ url: "/note.md" }));
	await board.stop();
	await waitFor(() => expect(client.registry.get(client.updates.status).connection).toBe("reconnecting"));
});

it("reads getting-started templates through the shared native page contract", async () => {
	await open();
	const page = await client.read(client.api.page.query({ url: "/_board/start" }));
	expect(page.status).toBe(200);
	expect(page.html).toContain("Project and report templates");
	expect(page.html).toContain('data-view="start"');
	expect(page.html).toContain("example.result");
});
