import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Context, Effect, Exit, FileSystem, Layer, Path, Scope, Tracer } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { DiagnosticsSources, type Sources } from "#diagnostics/source.ts";
import { serveBoard } from "#server/serve.ts";

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
	readonly stop: () => Effect.Effect<void>;
	readonly url: string;
}

export type FileSystemWrapper = (fs: FileSystem.FileSystem) => FileSystem.FileSystem;

function wrapped(wrap: FileSystemWrapper) {
	return Layer.effect(FileSystem.FileSystem, Effect.map(Effect.service(FileSystem.FileSystem), wrap)).pipe(Layer.provide(NodeServices.layer));
}

export const startBoard = Effect.fn("Test.startBoard")(function* (
	root: string,
	home?: string,
	wrap: FileSystemWrapper = (fs) => fs,
	responses = false,
	sources?: Sources,
	maintainer?: string,
	fleetPort?: number | null,
	tracer?: Tracer.Tracer,
	path?: Path.Path,
) {
	const board = Layer.provide(
		serveBoard({ ...(fleetPort === undefined ? {} : { fleetPort }), home, maintainer, port: 0, responses, root }),
		Layer.mergeAll(
			NodeServices.layer,
			wrapped(wrap),
			path ? Layer.succeed(Path.Path, path) : Layer.empty,
			sources === undefined ? Layer.empty : Layer.succeed(DiagnosticsSources)(sources),
		),
	);
	const scope = yield* Scope.fork(yield* Scope.Scope);
	const context = yield* Layer.buildWithScope(board.pipe(Layer.provideMerge(tracer ? Layer.succeed(Tracer.Tracer, tracer) : Layer.empty)), scope);
	const server = Context.get(context, HttpServer.HttpServer);
	if (!NetAddress.isInetAddress(server.address)) {
		throw new Error("the board did not listen on TCP");
	}
	const hostname = NetAddress.formatIp(server.address.address);
	const { port } = server.address;
	return { hostname, port, stop: () => Scope.close(scope, Exit.void), url: `http://${hostname}:${port}` };
});

export interface RawResponse {
	readonly body: string;
	readonly location?: string;
	readonly status: number;
}

export function rawGet(board: RunningBoard, path: string, host?: string): Effect.Effect<RawResponse> {
	return Effect.promise(
		() =>
			new Promise<RawResponse>((resolve, reject) => {
				const outgoing = request({ headers: host === undefined ? {} : { host }, host: board.hostname, path, port: board.port }, (response) => {
					let body = "";
					response.setEncoding("utf8");
					response.on("data", (chunk: string) => {
						body += chunk;
					});
					response.on("end", () =>
						resolve({ body, ...(response.headers.location ? { location: response.headers.location } : {}), status: response.statusCode ?? 0 }),
					);
				});
				outgoing.on("error", reject);
				outgoing.end();
			}),
	);
}

export function rawPost(board: RunningBoard, path: string, headers: Readonly<Record<string, string>>, body = ""): Effect.Effect<RawResponse> {
	return Effect.promise(
		() =>
			new Promise<RawResponse>((resolve, reject) => {
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
			}),
	);
}
