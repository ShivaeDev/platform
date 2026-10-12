import { chmodSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { afterEach, describe, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { loopbackOnly } from "@shivaedev/platform/rpc-server/local.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { countingPaths, silentWatch } from "#test/faults.ts";
import { changesUntil, subscribe } from "#test/nativeRpc.ts";
import { referenceLink } from "#test/referenceLink.ts";

let notes: Folder;
let outside: Folder;
let board: RunningBoard;

const setupBoard = Effect.gen(function* () {
	outside = folder({ "private.md": "# Outside the folder\n" });
	notes = folder({
		".drafts/hidden.md": "# Hidden\n",
		"node_modules/pkg/readme.md": "# Dependency\n",
		"notes/log.md": "# Log\n",
		"notes/raw.txt": "plain\n",
		"plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n",
	});
	board = yield* startBoard(notes.root, "plan.md");
});

const { effectApp } = makeEffectIt({ clock: "live", layer: Layer.empty, makeHarness: () => setupBoard });

afterEach(() => {
	notes.remove();
	outside.remove();
});

function get(path: string) {
	return fetch(`${board.url}${path}`);
}

describe("pages", () => {
	effectApp("shows the home file as a board with its counts and every markdown file in the top bar", function* () {
		const html = yield* Effect.promise(async () => (await get("/")).text());
		expect(html).toContain("<span><b>1</b> to do</span>");
		expect(html).toContain('<a href="/plan.md" aria-current="page">plan</a>');
		expect(html).toContain('<a href="/notes/log.md">log</a>');
	});

	effectApp("shows any other markdown file as a document and answers 404 for a missing one", function* () {
		expect(yield* Effect.promise(async () => (await get("/notes/log.md")).text())).toContain(
			'<header class="item-introduction"><h1 id="heading-log" tabindex="-1">Log<a aria-label="Link to Log" class="heading-anchor" href="#heading-log"></a></h1>',
		);
		expect((yield* Effect.promise(() => get("/notes/missing.md"))).status).toBe(404);
	});

	effectApp("shows the first file as a document at / when no home is given", function* () {
		yield* board.stop();
		board = yield* startBoard(notes.root);
		const html = yield* Effect.promise(async () => (await get("/")).text());
		expect(html).toContain(
			'<header class="item-introduction"><h1 id="heading-plan" tabindex="-1">Plan<a aria-label="Link to Plan" class="heading-anchor" href="#heading-plan"></a></h1>',
		);
		expect(html).not.toContain('class="counts"');
	});

	effectApp("skips dot folders, node_modules and files that are not markdown", function* () {
		const html = yield* Effect.promise(async () => (await get("/")).text());
		expect(html).not.toContain("hidden.md");
		expect(html).not.toContain(".drafts/");
		expect(html).not.toContain("readme");
		expect(html).not.toContain("raw");
		expect((yield* Effect.promise(() => get("/.drafts/hidden.md"))).status).toBe(404);
		expect((yield* Effect.promise(() => get("/node_modules/pkg/readme.md"))).status).toBe(404);
		expect((yield* Effect.promise(() => get("/notes/raw.txt"))).status).toBe(404);
	});

	effectApp("never enters dot folders or node_modules while listing", function* () {
		yield* board.stop();
		const counting = countingPaths();
		board = yield* startBoard(notes.root, "plan.md", counting.wrap);
		expect(yield* Effect.promise(async () => (await get("/")).text())).toContain('<a href="/notes/log.md">log</a>');
		expect(counting.visited).toContain(`${notes.root}/notes`);
		expect(counting.visited.filter((path) => path.includes("/.drafts") || path.includes("/node_modules"))).toEqual([]);
	});

	effectApp("never serves a file outside the folder", function* () {
		const outsidePath = `/..%2f${outside.root.split("/").at(-1)}%2fprivate.md`;
		const response = yield* rawGet(board, outsidePath);
		expect(response.status).toBe(404);
		expect(response.body).not.toContain("Outside the folder");
	});

	effectApp("includes explicit linked folders but refuses escaping file links and ancestor folders", function* () {
		yield* board.stop();
		referenceLink(notes, "leak.md", join(outside.root, "private.md"));
		referenceLink(notes, "up", "..");
		referenceLink(notes, "notes/elsewhere", outside.root);
		referenceLink(notes, "notes/alias.md", join(notes.root, "plan.md"));
		board = yield* startBoard(notes.root, "plan.md");
		const html = yield* Effect.promise(async () => (await get("/")).text());
		expect(html).not.toContain("leak.md");
		expect(html).toContain('<a href="/notes/elsewhere/private.md">private</a>');
		expect(yield* Effect.promise(async () => (await get("/notes/elsewhere/private.md")).text())).toContain("Outside the folder");
		expect(html).not.toContain("Outside the folder");
		expect(html).toContain('<a href="/notes/alias.md">alias</a>');
		for (const path of ["/leak.md", `/up/${outside.root.split("/").at(-1)}/private.md`]) {
			const response = yield* Effect.promise(() => get(path));
			expect(response.status).toBe(404);
			expect(yield* Effect.promise(() => response.text())).not.toContain("Outside the folder");
		}
		expect(yield* Effect.promise(async () => (await get("/notes/alias.md")).text())).toContain(
			'<header class="item-introduction"><h1 id="heading-plan" tabindex="-1">Plan<a aria-label="Link to Plan" class="heading-anchor" href="#heading-plan"></a></h1>',
		);
	});

	effectApp("checks where a listed file leads again before reading it", function* () {
		yield* board.stop();
		board = yield* startBoard(notes.root, "plan.md", silentWatch);
		expect((yield* Effect.promise(() => get("/notes/log.md"))).status).toBe(200);
		rmSync(join(notes.root, "notes/log.md"));
		referenceLink(notes, "notes/log.md", join(outside.root, "private.md"));
		const response = yield* Effect.promise(() => get("/notes/log.md"));
		expect(response.status).toBe(404);
		expect(yield* Effect.promise(() => response.text())).not.toContain("Outside the folder");
	});

	effectApp("never shows a symlink outside the folder as the first file", function* () {
		yield* board.stop();
		referenceLink(notes, "a-leak.md", join(outside.root, "private.md"));
		board = yield* startBoard(notes.root);
		const response = yield* Effect.promise(() => get("/"));
		const html = yield* Effect.promise(() => response.text());
		expect(html).not.toContain("Outside the folder");
		expect(html).toContain(
			'<header class="item-introduction"><h1 id="heading-plan" tabindex="-1">Plan<a aria-label="Link to Plan" class="heading-anchor" href="#heading-plan"></a></h1>',
		);
	});

	effectApp("links and serves files whose names contain # or ?", function* () {
		notes.write("notes/c# & more?.md", "# Sharp\n");
		const html = yield* Effect.promise(async () => (await get("/")).text());
		expect(html).toContain('<a href="/notes/c%23%20%26%20more%3F.md">c# &amp; more?</a>');
		expect(yield* Effect.promise(async () => (await get("/notes/c%23%20%26%20more%3F.md")).text())).toContain(
			'<header class="item-introduction"><h1 id="heading-sharp" tabindex="-1">Sharp<a aria-label="Link to Sharp" class="heading-anchor" href="#heading-sharp"></a></h1>',
		);
	});

	effectApp("shows a readable error page for a listed file it cannot read", function* () {
		chmodSync(join(notes.root, "notes/log.md"), 0o000);
		const response = yield* Effect.promise(() => get("/notes/log.md"));
		expect(response.status).toBe(500);
		const html = yield* Effect.promise(() => response.text());
		expect(html).toContain('<p class="empty">notes/log.md could not be read.</p>');
		expect(html).toContain('<a href="/plan.md">plan</a>');
		chmodSync(join(notes.root, "notes/log.md"), 0o644);
	});

	effectApp("retains the folder listing and adds a watched file without rescanning directories", function* () {
		yield* board.stop();
		const counting = countingPaths();
		board = yield* startBoard(notes.root, "plan.md", counting.wrap);
		function listings() {
			return counting.listed.filter((path) => path.endsWith("/notes")).length;
		}
		yield* Effect.promise(() => get("/"));
		const once = listings();
		yield* Effect.promise(() => get("/"));
		yield* Effect.promise(() => get("/notes/log.md"));
		expect(listings()).toBe(once);
		const events = yield* subscribe(board);
		notes.write("notes/new.md", "# New\n");
		yield* changesUntil(events, "notes/new.md");
		yield* events.close();
		expect(yield* Effect.promise(async () => (await get("/")).text())).toContain('<a href="/notes/new.md">new</a>');
		expect(listings()).toBe(once);
	});

	effectApp("answers 404 for a path that is not valid percent-encoding", function* () {
		expect((yield* Effect.promise(() => get("/%E0%A4%A.md"))).status).toBe(404);
	});
});

describe("local-only safety", () => {
	effectApp("refuses a request addressed to a host that is not loopback", function* () {
		expect(yield* rawGet(board, "/", "board.example")).toEqual({ body: "Only loopback hosts are served", status: 403 });
		expect((yield* rawGet(board, "/_board/client.js", "board.example:4747")).status).toBe(403);
		expect((yield* rawGet(board, "/", `localhost:${board.port}`)).status).toBe(200);
	});

	effectApp("judges the Host header even when the request target names a loopback host", function* () {
		expect((yield* rawGet(board, `http://127.0.0.1:${board.port}/`, "board.example")).status).toBe(403);
		expect((yield* rawGet(board, "http://board.example/", `127.0.0.1:${board.port}`)).status).toBe(200);
	});

	effectApp("refuses a request from an address that is not loopback when the address is known", function* () {
		const handler = loopbackOnly(() => Effect.succeed(HttpServerResponse.text("served")));
		function from(address: string) {
			return HttpServerRequest.fromWeb(new Request("http://localhost/", { headers: { host: "localhost" } })).modify({
				remoteAddress: Option.some(address),
			});
		}
		expect((yield* handler(from("203.0.113.9"))).status).toBe(403);
		expect((yield* handler(from("::ffff:127.0.0.1"))).status).toBe(200);
		expect((yield* handler(from("::1"))).status).toBe(200);
	});

	effectApp("sends a policy that allows only the board's own scripts and forbids caching", function* () {
		const response = yield* Effect.promise(() => get("/"));
		expect(response.headers.get("content-security-policy")).toContain("script-src 'self' 'wasm-unsafe-eval';");
		expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});
});

describe("assets", () => {
	effectApp("serves the locally bundled native client from a source checkout", function* () {
		const response = yield* Effect.promise(() => get("/_board/native.js"));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/javascript");
		expect(yield* Effect.promise(() => response.text())).toBe(readFileSync(new URL("../../../assets/native.js", import.meta.url), "utf8"));
	});

	effectApp("serves Mermaid's modules from the installed package and nothing else", function* () {
		const mermaid = yield* Effect.promise(() => get("/_board/mermaid/mermaid.esm.min.mjs"));
		expect(mermaid.status).toBe(200);
		expect(mermaid.headers.get("content-type")).toBe("text/javascript");
		expect((yield* Effect.promise(() => get("/_board/mermaid/mermaid.esm.min.mjs.map"))).status).toBe(404);
		expect((yield* rawGet(board, "/_board/mermaid/..%2f..%2fpackage.json")).status).toBe(404);
	});

	effectApp("styles the page with system fonts and no remote or embedded assets", function* () {
		const response = yield* Effect.promise(() => get("/_board/style.css"));
		expect(response.headers.get("content-type")).toBe("text/css; charset=utf-8");
		const css = yield* Effect.promise(() => response.text());
		expect(css).toContain('--sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;');
		expect(css).toContain("--mono: ui-monospace, SFMono-Regular, Menlo, monospace;");
		expect(css).toContain("@media (prefers-color-scheme: dark)");
		expect(css).not.toMatch(/@font-face|@import|url\(/u);
	});
});
