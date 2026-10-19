import { Effect, Stream } from "effect";
import { expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { waitFor } from "#test/live.ts";

const readingProject = [
	projectFiles({ "nested/home.md": "# Home", "note.md": "---\nid: note\n---\n# Note\n\nRead this.", "other.md": "# Other" }),
	boardHome("nested/home.md"),
];

boardStory.it("reads typed documents, stable item URLs, navigation, search through native HTTP RPC", readingProject, function* ({ board, client }) {
	const page = yield* Effect.promise(() => client.read(client.api.document.query({ url: "/_board/item/note/" })));
	expect(page.source).toContain("Read this.");

	expect((yield* Effect.promise(() => client.read(client.api.library.query({})))).files).toEqual(
		expect.arrayContaining([expect.objectContaining({ href: "/note.md" })]),
	);
	expect((yield* Effect.promise(() => client.read(client.api.search.query({ query: "Read this" })))).results).toEqual(
		expect.arrayContaining([expect.objectContaining({ file: "note.md", kind: "passage" })]),
	);
	expect((yield* Effect.promise(() => fetch(`${board.url}/note.md`))).status).toBe(200);
	expect((yield* Effect.promise(() => fetch(`${board.url}/_board/native.js`))).status).toBe(404);
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
	const css = yield* Effect.promise(() => fetch(`${boardUrl}/_board/react.css`).then((response) => response.text()));
	const fonts = [...css.matchAll(/url\((?<font>\/_board\/react-assets\/[^)]+\.woff2)\)/gu)].map((match) => match.groups?.font);
	expect(fonts.some((font) => font?.includes("geist-latin-wght")) && fonts.some((font) => font?.includes("geist-mono-latin-wght"))).toBe(true);
	for (const font of new Set(fonts)) {
		const response = yield* Effect.promise(() => fetch(`${boardUrl}${font}`));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("font/woff2");
	}
});

boardStory.it(
	"retains unrelated mounted reads while reconciling dependent pages and navigation after source changes",
	readingProject,
	function* ({ client, editFile, waitForConnection }) {
		const atom = client.api.board.query({ url: "/note.md" });
		const release = client.registry.mount(atom);
		yield* waitForConnection();
		const initial = yield* Effect.promise(() => client.read(atom));
		const nav = client.api.navigation.query({ current: "note.md" });
		const releaseNav = client.registry.mount(nav);
		const oldNav = yield* Effect.promise(() => client.read(nav));
		editFile("other.md", "# Updated unrelated");
		yield* Effect.promise(() =>
			waitFor(() => {
				const result = client.registry.get(nav);
				expect(result._tag === "Success" && result.value !== oldNav).toBe(true);
			}),
		);
		expect(yield* Effect.promise(() => client.read(atom))).toBe(initial);
		editFile("note.md", "---\nid: note\n---\n# Changed note");
		yield* Effect.promise(() =>
			waitFor(() => {
				const read = client.registry.get(atom);
				expect(read._tag === "Success" && read.value.document.source.includes("Changed note")).toBe(true);
			}),
		);
		release();
		releaseNav();
	},
);

boardStory.it("enforces same-origin and loopback guards at the native route", readingProject, function* ({ board, post }) {
	const blocked = yield* Effect.promise(() =>
		fetch(`${board.url}/_board/rpc`, { body: "", headers: { origin: "https://remote.example" }, method: "POST" }),
	);
	expect(blocked.status).toBe(403);
	const rebound = yield* post("/_board/rpc", { host: "remote.example" });
	expect(rebound.status).toBe(403);
});

boardStory.it("requires the RPC content type even with responses disabled", readingProject, function* ({ board, post }) {
	const blocked = yield* post("/_board/rpc", { "content-type": "application/json", origin: board.url });
	expect(blocked.status).toBe(403);
});

boardStory.it(
	"interrupts an active native subscription when the HTTP server scope ends",
	readingProject,
	function* ({ board, client, waitForConnection }) {
		yield* waitForConnection();
		yield* board.stop();
		yield* Effect.promise(() => waitFor(() => expect(client.registry.get(client.updates.status).connection).toBe("reconnecting")));
	},
);

boardStory.it("delivers the initial reconciliation hint through the bound Board subscription", readingProject, function* ({ client }) {
	const hints = yield* Effect.promise(() =>
		client.run(
			Stream.runCollect(
				client.api.subscribe.run(undefined).pipe(
					Stream.filter((item) => item._tag !== "Indexing"),
					Stream.take(1),
				),
			),
		),
	);
	expect(hints).toEqual([{ _tag: "Resync" }]);
});

boardStory.it("updates getting-started guidance when the first Markdown file is added", [], function* ({ client, editFile, waitForConnection }) {
	const atom = client.api.start.query();
	const release = client.registry.mount(atom);
	yield* waitForConnection();
	expect((yield* Effect.promise(() => client.read(atom))).empty).toBe(true);
	editFile("first.md", "# First document");
	yield* Effect.promise(() =>
		waitFor(() => {
			const read = client.registry.get(atom);
			expect(read._tag === "Success" && !read.value.empty).toBe(true);
		}),
	);
	release();
});

boardStory.it("sets the Board response headers on native RPC responses", readingProject, function* ({ board }) {
	const response = yield* Effect.promise(() =>
		fetch(`${board.url}/_board/rpc`, {
			body: `${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag: "work-board.start" })}\n`,
			headers: { "content-type": "application/ndjson" },
			method: "POST",
		}),
	);
	expect(response.status).toBe(200);
	expect(response.headers.get("cache-control")).toBe("no-store");
	expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	expect(yield* Effect.promise(() => response.text())).toContain("example.project");
});
