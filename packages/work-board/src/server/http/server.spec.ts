import { chmodSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { Effect, Layer, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { afterEach, describe, expect } from "vitest";
import { makeEffectIt } from "@shivaedev/effect-test/vitest.ts";
import { loopbackOnly } from "@shivaedev/platform/server/rpc-server/local.ts";
import { type Folder, folder, type RunningBoard, rawGet, startBoard } from "#test/board.ts";
import { countingPaths, silentWatch } from "#test/faults.ts";
import { changesUntil, rpcPaths, subscribe } from "#test/nativeRpc.ts";
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
	effectApp("skips dot folders, node_modules and files that are not markdown", function* () {
		expect(yield* rpcPaths(board)).toEqual(["/notes/log.md", "/plan.md"]);
		expect((yield* Effect.promise(() => get("/.drafts/hidden.md"))).status).toBe(404);
		expect((yield* Effect.promise(() => get("/node_modules/pkg/readme.md"))).status).toBe(404);
		expect((yield* Effect.promise(() => get("/notes/raw.txt"))).status).toBe(404);
	});

	effectApp("never enters dot folders or node_modules while listing", function* () {
		yield* board.stop();
		const counting = countingPaths();
		board = yield* startBoard(notes.root, "plan.md", counting.wrap);
		expect(yield* rpcPaths(board)).toContain("/notes/log.md");
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
		expect(yield* rpcPaths(board)).toContain("/notes/elsewhere/private.md");
		expect((yield* Effect.promise(() => get("/notes/elsewhere/private.md"))).status).toBe(200);
		expect(html).not.toContain("Outside the folder");
		expect(yield* rpcPaths(board)).toContain("/notes/alias.md");
		for (const path of ["/leak.md", `/up/${outside.root.split("/").at(-1)}/private.md`]) {
			const response = yield* Effect.promise(() => get(path));
			expect(response.status).toBe(404);
			expect(yield* Effect.promise(() => response.text())).not.toContain("Outside the folder");
		}
		expect((yield* Effect.promise(() => get("/notes/alias.md"))).status).toBe(200);
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

	effectApp("links and serves files whose names contain # or ?", function* () {
		notes.write("notes/c# & more?.md", "# Sharp\n");
		expect(yield* rpcPaths(board)).toContain("/notes/c%23%20%26%20more%3F.md");
		expect((yield* Effect.promise(() => get("/notes/c%23%20%26%20more%3F.md"))).status).toBe(200);
	});

	effectApp("shows a readable error page for a listed file it cannot read", function* () {
		chmodSync(join(notes.root, "notes/log.md"), 0o000);
		const response = yield* Effect.promise(() => get("/notes/log.md"));
		expect(response.status).toBe(500);
		const html = yield* Effect.promise(() => response.text());
		expect(html).toContain("data-board-react-root");
		expect(yield* rpcPaths(board)).toContain("/plan.md");
		chmodSync(join(notes.root, "notes/log.md"), 0o644);
	});

	effectApp("retains the folder listing and adds a watched file without rescanning directories", function* () {
		yield* board.stop();
		const counting = countingPaths();
		board = yield* startBoard(notes.root, "plan.md", counting.wrap);
		function listings() {
			return counting.listed.filter((path) => path.endsWith("/notes")).length;
		}
		yield* Effect.promise(() => get("/notes/log.md"));
		const once = listings();
		yield* Effect.promise(() => get("/"));
		yield* Effect.promise(() => get("/notes/log.md"));
		expect(listings()).toBe(once);
		const events = yield* subscribe(board);
		notes.write("notes/new.md", "# New\n");
		yield* changesUntil(events, "notes/new.md");
		yield* events.close();
		expect(yield* rpcPaths(board)).toContain("/notes/new.md");
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
		expect(response.headers.get("x-content-type-options")).toBe("nosniff");
	});
});

describe("assets", () => {
	effectApp("serves the browser client in one React bundle from a source checkout", function* () {
		const response = yield* Effect.promise(() => get("/_board/react.js"));
		expect(response.status).toBe(200);
		expect(response.headers.get("content-type")).toBe("text/javascript");
		expect(yield* Effect.promise(() => response.text())).toBe(readFileSync(new URL("../../../assets/react.js", import.meta.url), "utf8"));
		expect((yield* Effect.promise(() => get("/_board/native.js"))).status).toBe(404);
	});

	effectApp("serves Mermaid's modules from the installed package and nothing else", function* () {
		const mermaid = yield* Effect.promise(() => get("/_board/mermaid/mermaid.esm.min.mjs"));
		expect(mermaid.status).toBe(200);
		expect(mermaid.headers.get("content-type")).toBe("text/javascript");
		expect((yield* Effect.promise(() => get("/_board/mermaid/mermaid.esm.min.mjs.map"))).status).toBe(404);
		expect((yield* rawGet(board, "/_board/mermaid/..%2f..%2fpackage.json")).status).toBe(404);
	});
});
