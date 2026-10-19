import { chmodSync, existsSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { Effect } from "effect";
import { rawExchange, rawGet, rawPost, startBoard } from "./board.ts";
import { boardCommand } from "./boardCommand.ts";
import { bundleBoard } from "./bundleBoard.ts";
import { embeddedBoard } from "./embeddedBoard.ts";
import { waitFor } from "./live.ts";
import { mcpClient } from "./mcpClient.ts";
import { rpcCall } from "./nativeRpc.ts";
import { renderRemaining } from "./renderRemaining.tsx";
import { attachServer, type ServingOptions, startProject } from "./servingEngine.ts";
import { socketRpc, staleSocket } from "./socketRpc.ts";
import { abandonedSocketStartup, socketStartup } from "./socketStartup.ts";
import { type BoardEngine, served } from "./storyEngine.ts";

export function servingVerbs(engine: BoardEngine, tell: (line: string) => void) {
	return {
		abandonStartup: () => {
			tell("a killed process leaves its startup lock");
			return abandonedSocketStartup(engine.notes.root);
		},
		connectClient: () => {
			tell("a native browser client connects to the HTTP board");
			return served(engine).client;
		},
		connectMcp: () => {
			tell("an agent connects to the board through MCP stdio");
			return mcpClient(engine.notes.root);
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
		launchCommand: (args: readonly string[] = []) => boardCommand(engine, args, tell),
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
		startAnother: (root: string) => {
			tell("another board starts in its own directory");
			return startBoard(root);
		},
		startEmbedded: Effect.fn("Story.startEmbedded")(function* () {
			tell("the application mounts the board beside its health route");
			const board = yield* embeddedBoard(engine.notes.root, engine.responses);
			yield* attachServer(engine, board);
			return board;
		}),
		startSocketWorker: (phase?: string) => {
			tell(`a separate process starts the board${phase ? ` and pauses at ${phase}` : ""}`);
			return socketStartup(engine.notes.root, phase);
		},
		startWithMissingAssets: Effect.fn("Story.startWithMissingAssets")(function* (assets: readonly string[]) {
			tell(`the board starts with unbuilt assets: ${assets.join(", ")}`);
			const board = yield* bundleBoard(engine.notes.root, assets);
			yield* attachServer(engine, board);
			return board;
		}),
		viewHtml: (path: string) => {
			tell(`the reader renders ${path} from HTTP RPC data`);
			return Effect.promise(() => renderRemaining(served(engine).board.url, path));
		},
		waitUntil: (observation: () => void | Promise<void>) => {
			tell("the reader waits for the observed live update");
			return Effect.promise(() => waitFor(observation));
		},
	};
}
