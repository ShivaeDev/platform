import { createServer, type RequestListener } from "node:http";
import { Effect, Exit, Scope } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { type ForwardingProxyOptions, forwardingProxy } from "#forwardingProxy.ts";
import { loopbackServer } from "#internal/loopback.ts";
import { storyKit } from "#storyKit.ts";

interface Answer {
	readonly body: string;
	readonly cookies: readonly string[];
	readonly headers: Readonly<Record<string, string>>;
	readonly status: number;
}

interface HostRequest {
	readonly body: string;
	readonly headers: Readonly<Record<string, string>>;
	readonly method: string;
	readonly path: string;
	readonly remoteAddress: string;
}

interface Proxy {
	readonly hostScope: Scope.Closeable;
	last: Answer | undefined;
	readonly proxyScope: Scope.Closeable;
	proxyUrl: string;
	readonly upstream: string;
}

function at(engine: Proxy, path: string, hostname: string) {
	if (engine.proxyUrl === "") {
		throw new Error("Start the forwarding proxy before sending a request.");
	}
	const url = new URL(path, engine.proxyUrl);
	url.hostname = hostname;
	return url;
}

function answered(engine: Proxy): Answer {
	if (engine.last === undefined) {
		throw new Error("Send a request through the proxy before reading its answer.");
	}
	return engine.last;
}

function hostRequest(engine: Proxy): HostRequest {
	return JSON.parse(answered(engine).body);
}

export const proxyHost = storyKit({
	clock: "live",
	*create() {
		const scope = yield* Scope.Scope;
		const hostScope = yield* Scope.fork(scope);
		const respond: RequestListener = async (request, response) => {
			const chunks: Buffer[] = [];
			for await (const chunk of request) {
				chunks.push(Buffer.from(chunk));
			}
			response.writeHead(HttpStatus.fromLiteral("Created"), {
				"content-type": "application/json",
				"set-cookie": ["first=one", "second=two"],
				"x-host": "reached",
			});
			response.end(
				JSON.stringify({
					body: Buffer.concat(chunks).toString(),
					headers: request.headers,
					method: request.method,
					path: request.url,
					remoteAddress: request.socket.remoteAddress,
				}),
			);
		};
		const url = yield* loopbackServer(createServer(respond)).pipe(Effect.provideService(Scope.Scope, hostScope));
		yield* loopbackServer(createServer(respond), { host: "::1", port: Number(new URL(url).port) }).pipe(
			Effect.provideService(Scope.Scope, hostScope),
		);
		const upstream = new URL(url);
		upstream.hostname = "localhost";
		const engine: Proxy = { hostScope, last: undefined, proxyScope: yield* Scope.fork(scope), proxyUrl: "", upstream: upstream.origin };
		return engine;
	},
	inspect: ({ last, proxyUrl, upstream }) => ({ last, proxyUrl, upstream }),
	name: "forwarding proxy",
	stages: [],
	verbs: (engine, story) => ({
		answer: () =>
			Effect.sync(() => {
				const { body, status } = answered(engine);
				return body === "" ? `HTTP ${status}` : `HTTP ${status} with a body`;
			}),
		closesProxy: () => {
			story.tell("the forwarding proxy's scope closes");
			return Scope.close(engine.proxyScope, Exit.void);
		},
		cookies: () => Effect.sync(() => answered(engine).cookies),
		forwardedFor: () => Effect.sync(() => hostRequest(engine).headers["x-forwarded-for"]),
		header: (name: string) => Effect.sync(() => answered(engine).headers[name]),
		hostSaw: () => Effect.sync(() => hostRequest(engine)),
		hostSawCallerAt: () => Effect.sync(() => hostRequest(engine).remoteAddress),
		reaches: (hostname: string) =>
			Effect.promise(() =>
				fetch(at(engine, "/echo", hostname)).then(
					(response) => `HTTP ${response.status}`,
					() => "connection refused",
				),
			),
		sends: (path: string, init: RequestInit = {}, hostname = "127.0.0.1") =>
			Effect.promise(async () => {
				story.tell(`a client sends ${init.method ?? "GET"} ${path} to the proxy at ${hostname}`);
				const response = await fetch(at(engine, path, hostname), init);
				engine.last = {
					body: await response.text(),
					cookies: response.headers.getSetCookie(),
					headers: Object.fromEntries(response.headers),
					status: response.status,
				};
			}),
		startsProxy: (options: ForwardingProxyOptions = {}) =>
			Effect.gen(function* () {
				story.tell("the forwarding proxy starts in front of the host");
				const proxy = yield* forwardingProxy(engine.upstream, options).pipe(Effect.provideService(Scope.Scope, engine.proxyScope));
				engine.proxyUrl = proxy.url;
			}),
		stopsHost: () => {
			story.tell("the host stops listening");
			return Scope.close(engine.hostScope, Exit.void);
		},
	}),
});
