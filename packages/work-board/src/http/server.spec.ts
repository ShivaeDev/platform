import { chmodSync, existsSync, linkSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loopbackOnly } from "#http/loopback.ts";
import { changesUntil, type Folder, folder, type RunningBoard, rawGet, startBoard, subscribe } from "#test/board.ts";
import { countingPaths, silentWatch } from "#test/faults.ts";

let notes: Folder;
let outside: Folder;
let board: RunningBoard;

beforeEach(async () => {
	outside = folder({ "private.md": "# Outside the folder\n" });
	notes = folder({
		".drafts/hidden.md": "# Hidden\n",
		"node_modules/pkg/readme.md": "# Dependency\n",
		"notes/log.md": "# Log\n",
		"notes/raw.txt": "plain\n",
		"plan.md": "# Plan\n\n## To do\n\n### `docs` Write the intro\n",
	});
	board = await startBoard(notes.root, "plan.md");
});

afterEach(async () => {
	await board.stop();
	notes.remove();
	outside.remove();
});

const get = (path: string) => fetch(`${board.url}${path}`);

describe("pages", () => {
	it("shows the home file as a board with its counts and every markdown file in the top bar", async () => {
		const html = await (await get("/")).text();
		expect(html).toContain("<span><b>1</b> to do</span>");
		expect(html).toContain('<a href="/plan.md" aria-current="page">plan</a>');
		expect(html).toContain('<a href="/notes/log.md">log</a>');
	});

	it("shows any other markdown file as a document and answers 404 for a missing one", async () => {
		expect(await (await get("/notes/log.md")).text()).toContain(
			'<article class="doc"><h1 id="heading-log" tabindex="-1">Log<a aria-label="Link to Log" class="heading-anchor" href="#heading-log"></a></h1>',
		);
		expect((await get("/notes/missing.md")).status).toBe(404);
	});

	it("shows the first file as a document at / when no home is given", async () => {
		await board.stop();
		board = await startBoard(notes.root);
		const html = await (await get("/")).text();
		expect(html).toContain(
			'<article class="doc"><h1 id="heading-plan" tabindex="-1">Plan<a aria-label="Link to Plan" class="heading-anchor" href="#heading-plan"></a></h1>',
		);
		expect(html).not.toContain('class="counts"');
	});

	it("skips dot folders, node_modules and files that are not markdown", async () => {
		const html = await (await get("/")).text();
		expect(html).not.toContain("hidden.md");
		expect(html).not.toContain(".drafts/");
		expect(html).not.toContain("readme");
		expect(html).not.toContain("raw");
		expect((await get("/.drafts/hidden.md")).status).toBe(404);
		expect((await get("/node_modules/pkg/readme.md")).status).toBe(404);
		expect((await get("/notes/raw.txt")).status).toBe(404);
	});

	it("never enters dot folders or node_modules while listing", async () => {
		await board.stop();
		const counting = countingPaths();
		board = await startBoard(notes.root, "plan.md", counting.wrap);
		expect(await (await get("/")).text()).toContain('<a href="/notes/log.md">log</a>');
		expect(counting.visited).toContain(`${notes.root}/notes`);
		expect(counting.visited.filter((path) => path.includes("/.drafts") || path.includes("/node_modules"))).toEqual([]);
	});

	it("never serves a file outside the folder", async () => {
		const outsidePath = `/..%2f${outside.root.split("/").at(-1)}%2fprivate.md`;
		const response = await rawGet(board, outsidePath);
		expect(response.status).toBe(404);
		expect(response.body).not.toContain("Outside the folder");
	});

	it("never lists or serves a symlink that leads outside the folder", async () => {
		await board.stop();
		symlinkSync(join(outside.root, "private.md"), join(notes.root, "leak.md"));
		symlinkSync("..", join(notes.root, "up"));
		symlinkSync(outside.root, join(notes.root, "notes/elsewhere"));
		symlinkSync(join(notes.root, "plan.md"), join(notes.root, "notes/alias.md"));
		board = await startBoard(notes.root, "plan.md");
		const html = await (await get("/")).text();
		expect(html).not.toContain("leak.md");
		expect(html).not.toContain("elsewhere");
		expect(html).not.toContain("private.md");
		expect(html).not.toContain("Outside the folder");
		expect(html).toContain('<a href="/notes/alias.md">alias</a>');
		for (const path of ["/leak.md", "/notes/elsewhere/private.md", `/up/${outside.root.split("/").at(-1)}/private.md`]) {
			const response = await get(path);
			expect(response.status).toBe(404);
			expect(await response.text()).not.toContain("Outside the folder");
		}
		expect(await (await get("/notes/alias.md")).text()).toContain(
			'<article class="doc"><h1 id="heading-plan" tabindex="-1">Plan<a aria-label="Link to Plan" class="heading-anchor" href="#heading-plan"></a></h1>',
		);
	});

	it("checks where a listed file leads again before reading it", async () => {
		await board.stop();
		board = await startBoard(notes.root, "plan.md", silentWatch);
		expect((await get("/notes/log.md")).status).toBe(200);
		rmSync(join(notes.root, "notes/log.md"));
		symlinkSync(join(outside.root, "private.md"), join(notes.root, "notes/log.md"));
		const response = await get("/notes/log.md");
		expect(response.status).toBe(404);
		expect(await response.text()).not.toContain("Outside the folder");
	});

	it("never shows a symlink outside the folder as the first file", async () => {
		await board.stop();
		symlinkSync(join(outside.root, "private.md"), join(notes.root, "a-leak.md"));
		board = await startBoard(notes.root);
		const response = await get("/");
		const html = await response.text();
		expect(html).not.toContain("Outside the folder");
		expect(html).toContain(
			'<article class="doc"><h1 id="heading-plan" tabindex="-1">Plan<a aria-label="Link to Plan" class="heading-anchor" href="#heading-plan"></a></h1>',
		);
	});

	it("links and serves files whose names contain # or ?", async () => {
		notes.write("notes/c# & more?.md", "# Sharp\n");
		const html = await (await get("/")).text();
		expect(html).toContain('<a href="/notes/c%23%20%26%20more%3F.md">c# &amp; more?</a>');
		expect(await (await get("/notes/c%23%20%26%20more%3F.md")).text()).toContain(
			'<article class="doc"><h1 id="heading-sharp" tabindex="-1">Sharp<a aria-label="Link to Sharp" class="heading-anchor" href="#heading-sharp"></a></h1>',
		);
	});

	it("shows a readable error page for a listed file it cannot read", async () => {
		chmodSync(join(notes.root, "notes/log.md"), 0o000);
		const response = await get("/notes/log.md");
		expect(response.status).toBe(500);
		const html = await response.text();
		expect(html).toContain('<p class="empty">notes/log.md could not be read.</p>');
		expect(html).toContain('<a href="/plan.md">plan</a>');
		chmodSync(join(notes.root, "notes/log.md"), 0o644);
	});

	it("lists the folder once and lists it again only after the watcher reports a change", async () => {
		await board.stop();
		const counting = countingPaths();
		board = await startBoard(notes.root, "plan.md", counting.wrap);
		const listings = () => counting.visited.filter((path) => path.endsWith("/notes")).length;
		await get("/");
		const once = listings();
		await get("/");
		await get("/notes/log.md");
		expect(listings()).toBe(once);
		const events = await subscribe(board);
		notes.write("notes/new.md", "# New\n");
		await changesUntil(events, "notes/new.md");
		events.close();
		expect(await (await get("/")).text()).toContain('<a href="/notes/new.md">new</a>');
		expect(listings()).toBeGreaterThan(once);
	});

	it("answers 404 for a path that is not valid percent-encoding", async () => {
		expect((await get("/%E0%A4%A.md")).status).toBe(404);
	});
});

describe("local-only safety", () => {
	it("refuses a request addressed to a host that is not loopback", async () => {
		expect(await rawGet(board, "/", "board.example")).toEqual({ body: "Only loopback hosts are served", status: 403 });
		expect((await rawGet(board, "/_board/client.js", "board.example:4747")).status).toBe(403);
		expect((await rawGet(board, "/", `localhost:${board.port}`)).status).toBe(200);
	});

	it("judges the Host header even when the request target names a loopback host", async () => {
		expect((await rawGet(board, `http://127.0.0.1:${board.port}/`, "board.example")).status).toBe(403);
		expect((await rawGet(board, "http://board.example/", `127.0.0.1:${board.port}`)).status).toBe(200);
	});

	it("refuses a request from an address that is not loopback when the address is known", async () => {
		const handler = loopbackOnly(() => Effect.succeed(HttpServerResponse.text("served")));
		const from = (address: string) =>
			HttpServerRequest.fromWeb(new Request("http://localhost/", { headers: { host: "localhost" } })).modify({ remoteAddress: Option.some(address) });
		expect((await Effect.runPromise(handler(from("203.0.113.9")))).status).toBe(403);
		expect((await Effect.runPromise(handler(from("::ffff:127.0.0.1")))).status).toBe(200);
		expect((await Effect.runPromise(handler(from("::1")))).status).toBe(200);
	});

	it("sends a policy that allows only the board's own scripts and forbids caching", async () => {
		const response = await get("/");
		expect(response.headers.get("content-security-policy")).toContain("script-src 'self';");
		expect(response.headers.get("content-security-policy")).toContain("default-src 'self'");
		expect(response.headers.get("cache-control")).toBe("no-store");
	});
});

describe("assets", () => {
	it("serves Mermaid's modules from the installed package and nothing else", async () => {
		const mermaid = await get("/_board/mermaid/mermaid.esm.min.mjs");
		expect(mermaid.status).toBe(200);
		expect(mermaid.headers.get("content-type")).toBe("text/javascript");
		expect((await get("/_board/mermaid/mermaid.esm.min.mjs.map")).status).toBe(404);
		expect((await rawGet(board, "/_board/mermaid/..%2f..%2fpackage.json")).status).toBe(404);
	});

	it("styles the page with system fonts and no remote or embedded assets", async () => {
		const response = await get("/_board/style.css");
		expect(response.headers.get("content-type")).toBe("text/css; charset=utf-8");
		const css = await response.text();
		expect(css).toContain('--sans: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;');
		expect(css).toContain("--mono: ui-monospace, SFMono-Regular, Menlo, monospace;");
		expect(css).toContain("@media (prefers-color-scheme: dark)");
		expect(css).not.toMatch(/@font-face|@import|url\(/u);
	});
});

describe("the home file", () => {
	it("is resolved relative to the folder", async () => {
		await board.stop();
		board = await startBoard(notes.root, "./notes/../plan.md");
		expect(await (await get("/")).text()).toContain("<span><b>1</b> to do</span>");
	});

	it("refuses a home symlink that leads outside the folder", async () => {
		await board.stop();
		symlinkSync(join(outside.root, "private.md"), join(notes.root, "home-link.md"));
		await expect(startBoard(notes.root, "home-link.md")).rejects.toThrow("The home file home-link.md is not a markdown file in");
		board = await startBoard(notes.root, "plan.md");
	});

	it("resolves a name that differs only in case to the listed file where the file system ignores case", async () => {
		await board.stop();
		notes.write("Upper.md", "# Upper\n\n## Doing\n\n### One\n");
		if (existsSync(join(notes.root, "UPPER.md"))) {
			board = await startBoard(notes.root, "upper.md");
			const html = await (await get("/")).text();
			expect(html).toContain("<span><b>1</b> doing</span>");
			expect(html).toContain('<a href="/Upper.md" aria-current="page">Upper</a>');
		} else {
			await expect(startBoard(notes.root, "upper.md")).rejects.toThrow("The home file upper.md is not a markdown file in");
			board = await startBoard(notes.root, "plan.md");
		}
	});

	it("picks the file with the requested name over a symlink or a hard link to it when a name differs only in case", async () => {
		await board.stop();
		symlinkSync("plan.md", join(notes.root, "alias.md"));
		linkSync(join(notes.root, "plan.md"), join(notes.root, "a-copy.md"));
		if (existsSync(join(notes.root, "PLAN.md"))) {
			board = await startBoard(notes.root, "PLAN.md");
			expect(await (await get("/")).text()).toContain('<a href="/plan.md" aria-current="page">plan</a>');
		} else {
			await expect(startBoard(notes.root, "PLAN.md")).rejects.toThrow("The home file PLAN.md is not a markdown file in");
			board = await startBoard(notes.root, "plan.md");
		}
	});

	it("picks the file over a symlink to it when the home is reached another way", async () => {
		await board.stop();
		symlinkSync("plan.md", join(notes.root, "alias.md"));
		linkSync(join(notes.root, "plan.md"), join(notes.root, ".drafts/plan-copy.md"));
		board = await startBoard(notes.root, ".drafts/plan-copy.md");
		expect(await (await get("/")).text()).toContain('<a href="/plan.md" aria-current="page">plan</a>');
	});

	it("must exist, or the board does not start", async () => {
		await board.stop();
		await expect(startBoard(notes.root, "missing.md")).rejects.toThrow(`The home file missing.md is not a markdown file in ${notes.root}`);
		board = await startBoard(notes.root, "plan.md");
	});
});
