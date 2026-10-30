import { subscribe, unsubscribe } from "node:diagnostics_channel";
import { type ClientRequest, request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type ServerResponse } from "node:http";
import { Effect } from "effect";

export interface Send {
	readonly body?: string;
	readonly headers?: Readonly<Record<string, string>>;
	readonly hostname?: string;
	readonly method?: string;
}

interface Call {
	body: Buffer[];
	ended: boolean;
	failure: string | undefined;
	readonly finished: Promise<void>;
	headers: IncomingHttpHeaders | undefined;
	readonly headersSeen: Promise<void>;
	readonly request: ClientRequest;
	status: number | undefined;
	unread: Buffer[];
	waitingForChunk: (() => void) | undefined;
}

function failureOf(error: Error) {
	const code = "code" in error ? error.code : undefined;
	if (code === "ECONNRESET") {
		return "connection reset";
	}
	return code === "ECONNREFUSED" ? "connection refused" : error.message;
}

export function bytesInWords(bytes: Buffer): string {
	return [...bytes.toString("latin1").matchAll(/[\x20-\x7e]+|[^\x20-\x7e]+/gu)]
		.map(([run]) =>
			/^[\x20-\x7e]/u.test(run) ? run : `<${[...Buffer.from(run, "latin1")].map((byte) => byte.toString(16).padStart(2, "0")).join(" ")}>`,
		)
		.join("");
}

function call(url: URL, send: Send): Call {
	const headersSeen = Promise.withResolvers<void>();
	const finished = Promise.withResolvers<void>();
	const state: Call = {
		body: [],
		ended: false,
		failure: undefined,
		finished: finished.promise,
		headers: undefined,
		headersSeen: headersSeen.promise,
		request: httpRequest(url, { headers: send.headers, method: send.method }, (response) => {
			state.status = response.statusCode;
			state.headers = response.headers;
			headersSeen.resolve();
			response.on("data", (chunk: Buffer) => {
				state.body.push(chunk);
				state.unread.push(chunk);
				state.waitingForChunk?.();
			});
			response.once("end", end);
			response.once("error", fail);
		}),
		status: undefined,
		unread: [],
		waitingForChunk: undefined,
	};
	function end() {
		state.ended = true;
		state.waitingForChunk?.();
		headersSeen.resolve();
		finished.resolve();
	}
	function fail(error: Error) {
		state.failure ??= failureOf(error);
		end();
	}
	state.request.once("error", fail);
	state.request.end(send.body);
	return state;
}

function progressOf(state: Call) {
	if (state.failure !== undefined) {
		return state.failure;
	}
	if (state.ended) {
		return "answered";
	}
	return state.status === undefined ? "waiting for an answer" : "waiting for its body";
}

function statusOf(state: Call) {
	return state.status === undefined ? (state.failure ?? "no answer") : `HTTP ${state.status}`;
}

function answerOf(state: Call) {
	const body = Buffer.concat(state.body);
	const status = statusOf(state);
	if (state.status !== undefined && state.failure !== undefined) {
		return `${status}, then ${state.failure}`;
	}
	return body.length === 0 ? status : `${status} ${bytesInWords(body)}`;
}

function isRequestStart(message: unknown): message is { readonly request: IncomingMessage; readonly response: ServerResponse } {
	return typeof message === "object" && message !== null && "request" in message && "response" in message;
}

export interface HangUps {
	readonly next: (path: string) => Promise<void>;
}

export function listensForHangUps(url: string) {
	const port = Number(new URL(url).port);
	const waiting: { readonly path: string; readonly resolve: () => void }[] = [];
	function started(message: unknown) {
		if (!isRequestStart(message) || message.request.socket.localPort !== port) {
			return;
		}
		const { request, response } = message;
		response.once("close", () => {
			for (const waiter of waiting.filter(({ path }) => path === request.url)) {
				waiting.splice(waiting.indexOf(waiter), 1);
				waiter.resolve();
			}
		});
	}
	const hangUps: HangUps = {
		next: (path) => {
			const closed = Promise.withResolvers<void>();
			waiting.push({ path, resolve: closed.resolve });
			return closed.promise;
		},
	};
	return Effect.acquireRelease(
		Effect.sync(() => {
			subscribe("http.server.request.start", started);
			return hangUps;
		}),
		() => Effect.sync(() => unsubscribe("http.server.request.start", started)),
	);
}

export function httpClient(baseUrl: () => string, tell: (line: string) => void, defaults: () => Send = () => ({}), hangUps?: HangUps) {
	const calls = new Map<string, { readonly path: string; readonly state: Call }>();
	function named(name: string) {
		const found = calls.get(name);
		if (found === undefined) {
			throw new Error(`No request named "${name}" was sent.`);
		}
		return found;
	}
	function open(name: string, path: string, send: Send) {
		const options = { ...defaults(), ...send };
		const url = new URL(path, baseUrl());
		if (options.hostname !== undefined) {
			url.hostname = options.hostname;
		}
		return Effect.acquireRelease(
			Effect.sync(() => {
				const state = call(url, options);
				calls.set(name, { path, state });
				return state;
			}),
			(state) => Effect.sync(() => state.request.destroy()),
		).pipe(Effect.asVoid);
	}
	function sends(name: string, path = "/data", send: Send = {}) {
		tell(`${name} sends ${send.method ?? "GET"} ${path}`);
		return open(name, path, send);
	}
	return {
		abandons: (name: string) => {
			const { path, state } = named(name);
			tell(`${name} hangs up`);
			return Effect.promise(() => {
				if (hangUps === undefined) {
					throw new Error("Give the HTTP client the service's hang-ups before a request abandons it.");
				}
				const closed = hangUps.next(path);
				state.request.destroy();
				return closed;
			});
		},
		answer: (name: string) => {
			const { state } = named(name);
			return Effect.promise(() => state.finished).pipe(Effect.map(() => answerOf(state)));
		},
		asks: (path: string, send: Send = {}) =>
			Effect.scoped(
				Effect.gen(function* () {
					const name = `${send.method ?? "GET"} ${path}`;
					tell(`the client asks for ${name}`);
					yield* open(name, path, send);
					const { state } = named(name);
					yield* Effect.promise(() => state.finished);
					return answerOf(state);
				}),
			),
		header: (name: string, header: string) => {
			const { state } = named(name);
			return Effect.promise(() => state.headersSeen).pipe(Effect.map(() => state.headers?.[header]));
		},
		nextChunk: (name: string) => {
			const { state } = named(name);
			return Effect.promise(async () => {
				while (state.unread.length === 0 && !state.ended) {
					await new Promise<void>((resolve) => {
						state.waitingForChunk = resolve;
					});
				}
				const chunk = state.unread.shift();
				return chunk === undefined ? "the end of the body" : bytesInWords(chunk);
			});
		},
		progress: (name: string) => Effect.sync(() => progressOf(named(name).state)),
		sends,
		status: (name: string) => {
			const { state } = named(name);
			return Effect.promise(() => state.headersSeen).pipe(Effect.map(() => statusOf(state)));
		},
	};
}
