import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Deferred, Effect } from "effect";
import { browserClient } from "#client/client.ts";
import type { Sources } from "#diagnostics/source.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { responseFrom } from "#server/responses/records.ts";
import { type FileSystemWrapper, type Folder, folder, type RunningBoard, startBoard } from "./board.ts";
import { type OpenPage, openPage } from "./browser.ts";

export interface BoardEngine {
	activeDiagnosticsPolls?: () => number;
	beforeScripts?: Parameters<typeof openPage>[2];
	fleetPort?: number | undefined;
	home?: string | undefined;
	lastView?: ReturnType<typeof readerView>;
	live?: { board: RunningBoard; client: ReturnType<typeof browserClient>; page: OpenPage };
	readonly notes: Folder;
	path: string;
	pollDiagnostics?: () => void;
	readAt?: number;
	reads?: WorkspaceReads;
	responses: boolean;
	server?: { board: RunningBoard; client: ReturnType<typeof browserClient> };
	sources?: Sources;
	wrap?: FileSystemWrapper | undefined;
}

export interface WorkspaceReads {
	readonly files: string[];
	readonly gate?: Deferred.Deferred<void>;
}

export function wrapFilesystem(engine: BoardEngine, wrap?: FileSystemWrapper) {
	const previous = engine.wrap;
	engine.wrap = (fs) => {
		const boundary = previous ? previous(fs) : fs;
		return wrap ? wrap(boundary) : boundary;
	};
}

export function connected(engine: BoardEngine) {
	if (!engine.live) {
		throw new Error("The story has no bundle page. Add the readerAt(path) reader trait before reading page or opening through reader.");
	}
	return engine.live;
}

export function served(engine: BoardEngine) {
	if (!engine.server) {
		throw new Error("The story's board has not started");
	}
	return engine.server;
}

export function* createBoard() {
	const notes = yield* Effect.acquireRelease(
		Effect.sync(() => folder({})),
		(acquired) => Effect.sync(acquired.remove),
	);
	const engine: BoardEngine = { notes, path: "/", responses: false };
	return engine;
}

export function* serveProject(engine: BoardEngine) {
	const board = yield* startBoard(engine.notes.root, engine.home, engine.wrap, engine.responses, engine.sources, undefined, engine.fleetPort);
	let client: ReturnType<typeof browserClient> | undefined;
	yield* Effect.addFinalizer(() => Effect.sync(() => client?.registry.dispose()));
	// A client starts reading the workspace, so server-only stories create it when a verb first uses it.
	engine.server = {
		board,
		get client() {
			client ??= browserClient(board.url);
			return client;
		},
	};
}

export function* openReader(engine: BoardEngine) {
	if (engine.live) {
		return;
	}
	const { board, client } = served(engine);
	const page = yield* openPage(board, engine.path, engine.beforeScripts);
	engine.live = { board, client, page };
	yield* rememberReader(engine);
}

export function rememberReader(engine: BoardEngine) {
	return Effect.addFinalizer(() =>
		Effect.sync(() => {
			engine.lastView ??= readerView(engine);
		}),
	);
}

export function inspectBoard(engine: BoardEngine) {
	return engine.lastView ?? readerView(engine);
}

export function savedResponseFiles(engine: BoardEngine) {
	try {
		return readdirSync(join(engine.notes.root, "responses"))
			.filter((file) => file.endsWith(".md"))
			.map((file) => ({
				file: `responses/${file}`,
				source: readFileSync(join(engine.notes.root, "responses", file), "utf8"),
			}));
	} catch {
		return [];
	}
}

export function readerView(engine: BoardEngine) {
	const page = engine.live?.page;
	const document = page?.document.getElementById("doc");
	return {
		html: document?.innerHTML,
		inbox: ["inbox-count", "inbox-topbar-count"].map((id) => page?.document.getElementById(id)?.textContent),
		location: page?.window.location.href,
		responseStatus: page?.document.getElementById("response-status")?.textContent,
		savedResponses: savedResponseItems(engine),
		text: page && document instanceof page.window.HTMLElement ? document.innerText : undefined,
	};
}

export function savedResponseItems(engine: BoardEngine) {
	return savedResponseFiles(engine).flatMap(({ file, source }) => {
		const record = responseFrom({ file, modified: 0, parsed: metadataParse(source) });
		return record ? [{ file, ...record }] : [];
	});
}
