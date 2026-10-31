import { chmodSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { Effect, Fiber } from "effect";
import { rawExchange, rawGet, rawPost } from "#test/board.ts";
import { bundleBoard } from "#test/bundleBoard.ts";
import { embeddedBoard } from "#test/embeddedBoard.ts";
import { rpcCall } from "#test/nativeRpc.ts";
import { renderRemaining } from "#test/renderRemaining.tsx";
import { attachServer, type ServingOptions, startProject } from "#test/servingEngine.ts";
import { socketRpc, staleSocket } from "#test/socketRpc.ts";
import { abandonedSocketStartup } from "#test/socketStartup.ts";
import { type BoardEngine, served } from "#test/storyEngine.ts";

export function servingVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		abandonStartup: () => {
			tell("a killed process leaves its startup lock");
			return abandonedSocketStartup(engine.notes.root);
		},
		exchange: (path: string, headers: Readonly<Record<string, string>> = {}, method = "GET", body = "") => {
			const sent = Object.entries(headers).map(([name, value]) => `${name}: ${value}`);
			tell(`a local HTTP client sends ${method} ${path}${sent.length > 0 ? ` with ${sent.join(", ")}` : ""}`);
			return rawExchange(served(engine).board, path, headers, method, body);
		},
		files: () => {
			tell("the reader inspects the files left in the project");
			return readdirSync(engine.notes.root);
		},
		get: (path: string, host?: string) => {
			tell(`a local HTTP client requests ${path}`);
			return rawGet(served(engine).board, path, host);
		},
		leaveStaleSocket: () => {
			tell("a stopped process leaves an unanswered Unix socket");
			return Effect.promise(() => staleSocket(join(engine.notes.root, "board.sock")));
		},
		permissions: (path: string, mode: number) => {
			tell(`an outside editor changes permissions on ${path}`);
			chmodSync(join(engine.notes.root, path), mode);
		},
		post: (path: string, headers: Readonly<Record<string, string>>, body = "") => {
			tell(`a local HTTP client posts to ${path}`);
			return rawPost(served(engine).board, path, headers, body);
		},
		removeFile: (path: string) => {
			tell(`an outside editor removes ${path}`);
			rmSync(join(engine.notes.root, path), { recursive: true });
		},
		request: (path: string, init?: RequestInit) => {
			tell(`a reader sends ${init?.method ?? "GET"} ${path}`);
			return Effect.promise(() => fetch(new URL(path, served(engine).board.url), init));
		},
		rpc: <A, E>(read: Parameters<typeof rpcCall<A, E>>[1]) => {
			tell("a native RPC client reads the board over HTTP");
			return rpcCall(served(engine).board, read);
		},
		socketCall: (tag: string, tcp = false) => {
			tell(`a local ${tcp ? "TCP" : "socket"} client calls ${tag}`);
			return Effect.promise(() => socketRpc(tcp ? served(engine).board.url : join(engine.notes.root, "board.sock"), tag));
		},
		socketState: () => {
			tell("the reader inspects the board's socket");
			const path = join(engine.notes.root, "board.sock");
			return existsSync(path) ? { mode: statSync(path).mode & 0o777, socket: statSync(path).isSocket() } : undefined;
		},
		start: (options?: ServingOptions) => {
			tell("the board starts serving the project over loopback HTTP");
			return Effect.gen(() => startProject(engine, options));
		},
		startEmbedded: Effect.fn("Story.startEmbedded")(function* () {
			tell("the application mounts the board beside its health route");
			const board = yield* embeddedBoard(engine.notes.root, engine.responses);
			yield* attachServer(engine, board);
			return board;
		}),
		startWithMissingAssets: Effect.fn("Story.startWithMissingAssets")(function* (assets: readonly string[]) {
			tell(`the board starts with unbuilt assets: ${assets.join(", ")}`);
			const board = yield* bundleBoard(engine.notes.root, assets);
			yield* attachServer(engine, board);
			return board;
		}),
		stop: () => {
			tell("the board begins shutdown");
			return served(engine).board.stop().pipe(Effect.forkDetach, Effect.flatMap(Fiber.join), Effect.timeout("8 seconds"));
		},
		viewHtml: (path: string) => {
			tell(`the reader renders ${path} from HTTP RPC data`);
			return Effect.promise(() => renderRemaining(served(engine).board.url, path));
		},
	};
}
