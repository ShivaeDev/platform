import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, ManagedRuntime } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { boardLayer } from "../../src/board.ts";
import { listenOn } from "../../src/serve.ts";

export interface Folder {
	readonly root: string;
	readonly write: (path: string, content: string) => void;
	readonly remove: () => void;
}

export const folder = (files: Readonly<Record<string, string>>, prefix = "work-board-"): Folder => {
	const root = mkdtempSync(join(tmpdir(), prefix));
	const write = (path: string, content: string) => {
		mkdirSync(dirname(join(root, path)), { recursive: true });
		writeFileSync(join(root, path), content);
	};
	for (const [path, content] of Object.entries(files)) {
		write(path, content);
	}
	return { root, write, remove: () => rmSync(root, { force: true, recursive: true }) };
};

export interface RunningBoard {
	readonly url: string;
	readonly hostname: string;
	readonly port: number;
	readonly stop: () => Promise<void>;
}

export type FileSystemWrapper = (fs: FileSystem.FileSystem) => FileSystem.FileSystem;

const wrapped = (wrap: FileSystemWrapper) =>
	Layer.effect(FileSystem.FileSystem, Effect.map(Effect.service(FileSystem.FileSystem), wrap)).pipe(Layer.provide(NodeServices.layer));

export const startBoard = async (root: string, home?: string, wrap: FileSystemWrapper = (fs) => fs): Promise<RunningBoard> => {
	const board = Layer.provide(boardLayer({ root, home }), wrapped(wrap));
	const runtime = ManagedRuntime.make(HttpRouter.serve(board, { disableLogger: true }).pipe(Layer.provideMerge(listenOn(0))));
	const server = await runtime.runPromise(Effect.service(HttpServer.HttpServer));
	if (server.address._tag !== "TcpAddress") {
		throw new Error("the board did not listen on TCP");
	}
	const { hostname, port } = server.address;
	return { url: `http://${hostname}:${port}`, hostname, port, stop: () => runtime.dispose() };
};

export interface RawResponse {
	readonly status: number;
	readonly body: string;
}

export const rawGet = (board: RunningBoard, path: string, host?: string): Promise<RawResponse> =>
	new Promise((resolve, reject) => {
		const outgoing = request({ host: board.hostname, port: board.port, path, headers: host === undefined ? {} : { host } }, (response) => {
			let body = "";
			response.setEncoding("utf8");
			response.on("data", (chunk: string) => {
				body += chunk;
			});
			response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
		});
		outgoing.on("error", reject);
		outgoing.end();
	});

export interface EventStream {
	readonly next: () => Promise<string>;
	readonly close: () => void;
}

export const subscribe = async (board: RunningBoard): Promise<EventStream> => {
	const controller = new AbortController();
	const body = (await fetch(`${board.url}/events`, { signal: controller.signal })).body;
	if (body === null) {
		throw new Error("the event stream has no body");
	}
	const reader = body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = "";
	const next = async (): Promise<string> => {
		while (!buffer.includes("\n\n")) {
			const chunk = await reader.read();
			if (chunk.done) {
				throw new Error("the event stream ended");
			}
			buffer += chunk.value;
		}
		const [event = "", ...rest] = buffer.split("\n\n");
		buffer = rest.join("\n\n");
		return event;
	};
	return { next, close: () => controller.abort() };
};

export const changesUntil = async (events: EventStream, path: string): Promise<ReadonlyArray<ReadonlyArray<string>>> => {
	const seen: Array<ReadonlyArray<string>> = [];
	while (!seen.at(-1)?.includes(path)) {
		const event = await events.next();
		const data = /^event: change\ndata: (.*)$/.exec(event)?.[1];
		if (data !== undefined) {
			seen.push(JSON.parse(data).paths);
		}
	}
	return seen;
};
