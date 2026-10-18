import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { browserClient } from "#client/client.ts";
import { metadataParse } from "#server/metadata/parse.ts";
import { responseFrom } from "#server/responses/records.ts";
import { type FileSystemWrapper, type Folder, folder, type RunningBoard, startBoard } from "./board.ts";
import { type OpenPage, openPage } from "./browser.ts";

export interface BoardEngine {
	beforeScripts?: Parameters<typeof openPage>[2];
	fleetPort?: number | undefined;
	home?: string | undefined;
	lastView?: ReturnType<typeof readerView>;
	live?: { board: RunningBoard; client: ReturnType<typeof browserClient>; page: OpenPage };
	readonly notes: Folder;
	path: string;
	responses: boolean;
	wrap?: FileSystemWrapper | undefined;
}

export function connected(engine: BoardEngine) {
	if (!engine.live) {
		throw new Error("The story's board has not started");
	}
	return engine.live;
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
	const board = yield* startBoard(engine.notes.root, engine.home, engine.wrap, engine.responses, undefined, undefined, engine.fleetPort);
	const client = yield* Effect.acquireRelease(
		Effect.sync(() => browserClient(board.url)),
		(acquired) => Effect.sync(() => acquired.registry.dispose()),
	);
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
