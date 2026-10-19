import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type Deferred, Effect, type Semaphore } from "effect";
import type { browserClient } from "#client/client.ts";
import type { Sources } from "#diagnostics/source.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { responseFrom } from "#server/responses/records.ts";
import { type FileSystemWrapper, type Folder, folder, type RunningBoard } from "./board.ts";
import { type held, type OpenPage, openPage } from "./browser.ts";
import { startProject } from "./servingEngine.ts";

export interface BoardEngine {
	activeDiagnosticsPolls?: () => number;
	announcedChanges?: string[][];
	beforeScripts?: Parameters<typeof openPage>[2];
	changeDelivery?: { dropped: boolean; loseNext: boolean; omitPath?: string };
	connectionBoundary?: { readonly disconnect: () => void; readonly resume: () => void };
	fleetPort?: number | undefined;
	heldRequests?: Map<string, ReturnType<typeof held>>;
	home?: string | undefined;
	lastView?: ReturnType<typeof readerView>;
	linked?: import("./linkedProject.ts").LinkedProject;
	live?: { board: RunningBoard; client: ReturnType<typeof browserClient>; page: OpenPage };
	manualServing?: boolean;
	notes: Folder;
	outside?: Folder;
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
	readonly permits?: Semaphore.Semaphore;
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
	if (engine.manualServing) {
		return;
	}
	yield* startProject(engine);
}

export function* openReader(engine: BoardEngine, ready = true) {
	if (engine.live) {
		return;
	}
	const { board, client } = served(engine);
	const holds = new Map([...(engine.heldRequests ?? [])].map(([method, hold]) => [method, hold.gate]));
	const page = yield* openPage(board, engine.path, engine.beforeScripts, { holds, ready });
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
