import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import { RpcTest } from "effect/rpc";
import { type Element as PageElement, type Node as PageNode, Window } from "happy-dom";
import type { MockInstance } from "vitest";
import type { Document as DocumentRead } from "#browser/document/schema.ts";
import type { FleetItems } from "#diagnostics/fleetItems.ts";
import { fileUrl } from "#files/url.ts";
import { documentHeadings } from "#render/documentHeadings.ts";
import { workRpcs } from "#rpc/contract.ts";
import { Highlighter } from "#server/render/Highlighter.ts";
import { renderMarkdown } from "#server/render/markdown.ts";
import { fullIndex } from "./fullIndex.ts";
import { inMemoryBoard } from "./inMemoryBoard.ts";
import { rpcCall } from "./nativeRpc.ts";
import { renderRemaining } from "./renderRemaining.tsx";
import { type BoardEngine, served } from "./storyEngine.ts";

export const parser = new Window();

export function parsedHtml(html: string) {
	const container = parser.document.createElement("div");
	container.innerHTML = html;
	return container;
}

// Adjacent elements carry no whitespace in server markup, so a space is added where one word or number ends and the next begins.
export function text(element: PageElement | null | undefined) {
	const pieces: string[] = [];
	function walk(node: PageNode) {
		if (node.nodeType === 3) {
			pieces.push(node.textContent ?? "");
		}
		for (const child of node.childNodes) {
			walk(child);
		}
	}
	if (element) {
		walk(element);
	}
	return pieces
		.reduce((joined, piece) => (/[\p{L}\p{N}]$/u.test(joined) && /^[\p{L}\p{N}]/u.test(piece) ? `${joined} ${piece}` : joined + piece), "")
		.replace(/\s+/gu, " ")
		.trim();
}

export function afterFrontMatter(source: string) {
	return source.slice(source.indexOf("---", source.indexOf("---") + 3));
}

export const fleetDaemons = new WeakMap<BoardEngine, { items: FleetItems; readonly stop: () => Effect.Effect<void> }>();

export const fleetBriefRequests = new WeakMap<BoardEngine, string[][]>();

export const metadataSpies = new WeakMap<
	BoardEngine,
	{ readonly builds: MockInstance; readonly parses: MockInstance; readonly updates: MockInstance }
>();

export const mountedReadings = new WeakMap<
	BoardEngine,
	{ readonly atom: Atom.Atom<AsyncResult.AsyncResult<DocumentRead, unknown>>; latest: DocumentRead }
>();

export const workClient = RpcTest.makeClient(workRpcs, { flatten: true });

export const CLI = new URL("../server/cli.ts", import.meta.url).pathname;

export function workspaceReads(engine: BoardEngine) {
	function rpc<A, E>(read: Parameters<typeof rpcCall<A, E>>[1]) {
		return rpcCall(served(engine).board, read);
	}
	function search(query: string) {
		return rpc((client) => client("work-board.search", { query }));
	}
	function document(file: string) {
		const { client } = served(engine);
		return Effect.promise(() => client.run(client.api.document.run({ url: fileUrl(file) })));
	}
	function rendered(file: string) {
		return Effect.gen(function* () {
			const read = yield* document(file);
			return yield* renderMarkdown(read.source, {
				file: read.file,
				headings: documentHeadings(),
				questionActions: new Map(Object.entries(read.questionActions)),
			}).pipe(Effect.provide(Highlighter.layer));
		});
	}
	function system() {
		return Effect.promise(() => renderRemaining(served(engine).board.url, "/_board/system", engine.readAt)).pipe(Effect.map(parsedHtml));
	}
	function documentAt(url: string) {
		return rpc((client) => client("work-board.document", { url }));
	}
	function saved(file: string) {
		return readFileSync(join(engine.notes.root, file), "utf8");
	}
	function migrate() {
		return execFileSync(process.execPath, ["--conditions=source", CLI, "migrate", engine.notes.root], { encoding: "utf8" });
	}
	function inbox() {
		return Effect.gen(function* () {
			const snapshot = yield* fullIndex(engine.notes.root).pipe(Effect.provide(NodeServices.layer));
			return yield* Effect.scoped(
				Effect.flatMap(RpcTest.makeClient(workRpcs, { flatten: true }), (client) => client("work-board.inbox", undefined)),
			).pipe(Effect.provide(inMemoryBoard({}, { home: undefined, index: Effect.succeed(snapshot) })));
		});
	}
	// A freshly started board can list a file before its index settles, so readouts that are not about startup read the files on disk.
	function onDisk<A, E>(read: (client: Effect.Success<typeof workClient>) => Effect.Effect<A, E>) {
		const files = Object.fromEntries(
			readdirSync(engine.notes.root, { recursive: true, withFileTypes: true })
				.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
				.map((entry) => {
					const path = relative(engine.notes.root, join(entry.parentPath, entry.name));
					return [path, saved(path)];
				}),
		);
		return Effect.scoped(Effect.flatMap(workClient, read)).pipe(Effect.provide(inMemoryBoard(files, { home: undefined })));
	}
	function diskLibrary() {
		return onDisk((client) => client("work-board.library", { showFleet: true }));
	}
	function card(source: string) {
		return Effect.map(system(), (page) => page.querySelector(`[data-source="${source}"]`));
	}
	function daemon() {
		const running = fleetDaemons.get(engine);
		if (!running) {
			throw new Error("The story has no Fleet daemon");
		}
		return running;
	}
	function work(url: string) {
		return rpc((client) => client("work-board.work", { url }));
	}
	function goals() {
		return rpc((client) => client("work-board.goals", undefined));
	}
	return { card, daemon, diskLibrary, document, documentAt, goals, inbox, migrate, onDisk, rendered, rpc, saved, search, system, work };
}
