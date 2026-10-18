import { chmodSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { describe, expect } from "vitest";
import { boardHome, boardStory, projectFiles } from "#test/boardStory.ts";
import { countingPaths, silentWatch } from "#test/faults.ts";
import { changesUntil, rpcPaths } from "#test/nativeRpc.ts";
import { referenceLink } from "#test/referenceLink.ts";
import { outsideFiles } from "#test/servingTraits.ts";

const readingProject = [
	projectFiles({
		".drafts/hidden.md": "# Hidden\n",
		"node_modules/pkg/readme.md": "# Dependency\n",
		"notes/log.md": "# Log\n",
		"notes/raw.txt": "plain\n",
		"plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n",
	}),
	boardHome("plan.md"),
	outsideFiles({ "private.md": "# Outside the folder\n" }),
];

describe("pages", () => {
	boardStory.it("skips dot folders, node_modules and files that are not markdown", readingProject, function* ({ board, request }) {
		expect(yield* rpcPaths(board)).toEqual(["/notes/log.md", "/plan.md"]);
		expect((yield* request("/.drafts/hidden.md")).status).toBe(404);
		expect((yield* request("/node_modules/pkg/readme.md")).status).toBe(404);
		expect((yield* request("/notes/raw.txt")).status).toBe(404);
	});

	boardStory.it("never enters dot folders or node_modules while listing", readingProject, function* ({ board, notes, start }) {
		yield* board.stop();
		const counting = countingPaths();
		board = yield* start({ home: "plan.md", wrap: counting.wrap });
		expect(yield* rpcPaths(board)).toContain("/notes/log.md");
		expect(counting.visited).toContain(`${notes.root}/notes`);
		expect(counting.visited.filter((path) => path.includes("/.drafts") || path.includes("/node_modules"))).toEqual([]);
	});

	boardStory.it("never serves a file outside the folder", readingProject, function* ({ outside, get }) {
		const outsidePath = `/..%2f${outside.root.split("/").at(-1)}%2fprivate.md`;
		const response = yield* get(outsidePath);
		expect(response.status).toBe(404);
		expect(response.body).not.toContain("Outside the folder");
	});

	boardStory.it(
		"includes explicit linked folders but refuses escaping file links and ancestor folders",
		readingProject,
		function* ({ board, notes, outside, start, request }) {
			yield* board.stop();
			referenceLink(notes, "leak.md", join(outside.root, "private.md"));
			referenceLink(notes, "up", "..");
			referenceLink(notes, "notes/elsewhere", outside.root);
			referenceLink(notes, "notes/alias.md", join(notes.root, "plan.md"));
			board = yield* start({ home: "plan.md" });
			const html = yield* Effect.promise(async () => (await fetch(`${board.url}/`)).text());
			expect(html).not.toContain("leak.md");
			expect(yield* rpcPaths(board)).toContain("/notes/elsewhere/private.md");
			expect((yield* request("/notes/elsewhere/private.md")).status).toBe(200);
			expect(html).not.toContain("Outside the folder");
			expect(yield* rpcPaths(board)).toContain("/notes/alias.md");
			for (const path of ["/leak.md", `/up/${outside.root.split("/").at(-1)}/private.md`]) {
				const response = yield* request(path);
				expect(response.status).toBe(404);
				expect(yield* Effect.promise(() => response.text())).not.toContain("Outside the folder");
			}
			expect((yield* request("/notes/alias.md")).status).toBe(200);
		},
	);

	boardStory.it("checks where a listed file leads again before reading it", readingProject, function* ({ board, notes, outside, start, request }) {
		yield* board.stop();
		board = yield* start({ home: "plan.md", wrap: silentWatch });
		expect((yield* request("/notes/log.md")).status).toBe(200);
		rmSync(join(notes.root, "notes/log.md"));
		referenceLink(notes, "notes/log.md", join(outside.root, "private.md"));
		const response = yield* request("/notes/log.md");
		expect(response.status).toBe(404);
		expect(yield* Effect.promise(() => response.text())).not.toContain("Outside the folder");
	});

	boardStory.it("links and serves files whose names contain # or ?", readingProject, function* ({ board, request, editFile }) {
		editFile("notes/c# & more?.md", "# Sharp\n");
		expect(yield* rpcPaths(board)).toContain("/notes/c%23%20%26%20more%3F.md");
		expect((yield* request("/notes/c%23%20%26%20more%3F.md")).status).toBe(200);
	});

	boardStory.it("shows a readable error page for a listed file it cannot read", readingProject, function* ({ board, notes, request }) {
		chmodSync(join(notes.root, "notes/log.md"), 0o000);
		const response = yield* request("/notes/log.md");
		expect(response.status).toBe(500);
		const html = yield* Effect.promise(() => response.text());
		expect(html).toContain("data-board-react-root");
		expect(yield* rpcPaths(board)).toContain("/plan.md");
		chmodSync(join(notes.root, "notes/log.md"), 0o644);
	});

	boardStory.it(
		"retains the folder listing and adds a watched file without rescanning directories",
		readingProject,
		function* ({ board, start, request, editFile, watchProject }) {
			yield* board.stop();
			const counting = countingPaths();
			board = yield* start({ home: "plan.md", wrap: counting.wrap });
			function listings() {
				return counting.listed.filter((path) => path.endsWith("/notes")).length;
			}
			yield* request("/notes/log.md");
			const once = listings();
			yield* request("/");
			yield* request("/notes/log.md");
			expect(listings()).toBe(once);
			const events = yield* watchProject();
			expect(yield* events.next()).toEqual({ _tag: "Resync" });
			editFile("notes/new.md", "# New\n");
			expect(yield* changesUntil(events, "notes/new.md")).toMatchObject({
				_tag: "Changed",
				keys: expect.arrayContaining([{ _tag: "Item", collection: "work-board/documents", id: "notes/new.md" }]),
			});
			yield* events.close();
			expect(yield* rpcPaths(board)).toContain("/notes/new.md");
			expect(listings()).toBe(once);
		},
	);

	boardStory.it("answers 404 for a path that is not valid percent-encoding", readingProject, function* ({ request }) {
		expect((yield* request("/%E0%A4%A.md")).status).toBe(404);
	});
});

describe("local-only safety", () => {
	boardStory.it("refuses a request addressed to a host that is not loopback", readingProject, function* ({ board, get }) {
		expect(yield* get("/", "board.example")).toEqual({ body: "Only loopback hosts are served", status: 403 });
		expect((yield* get("/_board/client.js", "board.example:4747")).status).toBe(403);
		expect((yield* get("/", `localhost:${board.port}`)).status).toBe(200);
	});

	boardStory.it("judges the Host header even when the request target names a loopback host", readingProject, function* ({ board, get }) {
		expect((yield* get(`http://127.0.0.1:${board.port}/`, "board.example")).status).toBe(403);
		expect((yield* get("http://board.example/", `127.0.0.1:${board.port}`)).status).toBe(200);
	});

	boardStory.it("sends a policy that allows only the board's own scripts and forbids caching", readingProject, function* ({ request }) {
		const response = yield* request("/");
		expect(response.headers.get("content-security-policy")).toContain("script-src 'self' 'wasm-unsafe-eval';");
		expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
		expect(response.headers.get("cache-control")).toBe("no-store");
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});
});

describe("assets", () => {
	boardStory.it("serves the browser client in one React bundle from a source checkout", readingProject, function* ({ request }) {
		const response = yield* request("/_board/react.js");
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/javascript");
		expect(yield* Effect.promise(() => response.text())).toBe(readFileSync(new URL("../../../assets/react.js", import.meta.url), "utf8"));
		expect((yield* request("/_board/native.js")).status).toBe(404);
	});

	boardStory.it("serves Mermaid's modules from the installed package and nothing else", readingProject, function* ({ request, get }) {
		const mermaid = yield* request("/_board/mermaid/mermaid.esm.min.mjs");
		expect(mermaid.status).toBe(200);
		expect(mermaid.headers.get("content-type")).toBe("text/javascript");
		expect((yield* request("/_board/mermaid/mermaid.esm.min.mjs.map")).status).toBe(404);
		expect((yield* get("/_board/mermaid/..%2f..%2fpackage.json")).status).toBe(404);
	});
});
