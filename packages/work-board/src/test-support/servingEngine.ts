import { Effect, type Path, type Tracer } from "effect";
import { browserClient } from "#client/client.ts";
import type { Sources } from "#diagnostics/source.ts";
import { type FileSystemWrapper, type RunningBoard, startBoard } from "./board.ts";
import type { BoardEngine } from "./storyEngine.ts";

export interface ServingOptions {
	fleetPort?: number | null;
	home?: string;
	maintainer?: string;
	path?: Path.Path;
	responses?: boolean;
	sources?: Sources;
	tracer?: Tracer.Tracer;
	wrap?: FileSystemWrapper;
}

export function* startProject(engine: BoardEngine, options: ServingOptions = {}) {
	const board = yield* startBoard(
		engine.notes.root,
		options.home ?? engine.home,
		options.wrap ?? engine.wrap,
		options.responses ?? engine.responses,
		options.sources ?? engine.sources,
		options.maintainer,
		options.fleetPort === undefined ? engine.fleetPort : options.fleetPort,
		options.tracer,
		options.path,
	);
	yield* attachServer(engine, board);
	return board;
}

export function* attachServer(engine: BoardEngine, board: RunningBoard) {
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
