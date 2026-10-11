import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { boardLayer } from "#board.ts";
import { DiagnosticsSources, type Sources } from "#diagnostics/source.ts";
import { listenOn } from "#serve.ts";

export interface Folder {
	readonly remove: () => void;
	readonly root: string;
	readonly write: (path: string, content: string) => void;
}

export function folder(files: Readonly<Record<string, string>>, prefix = "work-board-"): Folder {
	const root = realpathSync(mkdtempSync(join(tmpdir(), prefix)));
	function write(path: string, content: string) {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	}
	for (const [path, content] of Object.entries(files)) {
		write(path, content);
	}
	return { remove: () => rmSync(root, { force: true, recursive: true }), root, write };
}

export interface RunningBoard {
	readonly hostname: string;
	readonly port: number;
	readonly stop: () => Promise<void>;
	readonly url: string;
}

export type FileSystemWrapper = (fs: FileSystem.FileSystem) => FileSystem.FileSystem;

function wrapped(wrap: FileSystemWrapper) {
	return Layer.effect(FileSystem.FileSystem, Effect.map(Effect.service(FileSystem.FileSystem), wrap)).pipe(Layer.provide(NodeServices.layer));
}

export async function startBoard(
	root: string,
	home?: string,
	wrap: FileSystemWrapper = (fs) => fs,
	responses = false,
	sources?: Sources,
	maintainer?: string,
): Promise<RunningBoard> {
	const board = Layer.provide(
		boardLayer({ home, maintainer, responses, root }),
		sources === undefined ? wrapped(wrap) : Layer.merge(wrapped(wrap), Layer.succeed(DiagnosticsSources)(sources)),
	);
	const runtime = ManagedRuntime.make(HttpRouter.serve(board, { disableLogger: true }).pipe(Layer.provideMerge(listenOn(0))));
	const server = await runtime.runPromise(Effect.service(HttpServer.HttpServer));
	if (server.address._tag !== "TcpAddress") {
		throw new Error("the board did not listen on TCP");
	}
	const { hostname, port } = server.address;
	return { hostname, port, stop: () => runtime.dispose(), url: `http://${hostname}:${port}` };
}

export interface RawResponse {
	readonly body: string;
	readonly status: number;
}

export function rawGet(board: RunningBoard, path: string, host?: string): Promise<RawResponse> {
	return new Promise((resolve, reject) => {
		const outgoing = request({ headers: host === undefined ? {} : { host }, host: board.hostname, path, port: board.port }, (response) => {
			let body = "";
			response.setEncoding("utf8");
			response.on("data", (chunk: string) => {
				body += chunk;
			});
			response.on("end", () => resolve({ body, status: response.statusCode ?? 0 }));
		});
		outgoing.on("error", reject);
		outgoing.end();
	});
}

export function rawPost(board: RunningBoard, path: string, headers: Readonly<Record<string, string>>, body = ""): Promise<RawResponse> {
	return new Promise((resolve, reject) => {
		const outgoing = request({ headers, host: board.hostname, method: "POST", path, port: board.port }, (response) => {
			let text = "";
			response.setEncoding("utf8");
			response.on("data", (chunk: string) => {
				text += chunk;
			});
			response.on("end", () => resolve({ body: text, status: response.statusCode ?? 0 }));
		});
		outgoing.on("error", reject);
		outgoing.end(body);
	});
}
