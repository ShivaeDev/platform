import { createServer, type RequestListener } from "node:http";
import { Effect, Exit, Scope } from "effect";
import { type ForwardingProxyOptions, forwardingProxy } from "#forwardingProxy.ts";
import { loopbackServer } from "#internal/loopback.ts";
import { storyKit } from "#storyKit.ts";

export const proxyHost = storyKit({
	clock: "live",
	*create() {
		const hostScope = yield* Scope.fork(yield* Scope.Scope);
		const respond: RequestListener = async (request, response) => {
			const chunks: Buffer[] = [];
			for await (const chunk of request) {
				chunks.push(Buffer.from(chunk));
			}
			response.writeHead(201, { "content-type": "application/json", "set-cookie": ["first=one", "second=two"], "x-host": "reached" });
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
		return { hostScope, proxyUrl: "", upstream: upstream.origin };
	},
	name: "forwarding proxy",
	stages: ["host"],
	verbs: (engine) => ({
		request: (path: string, init: RequestInit = {}, hostname = "127.0.0.1") =>
			Effect.tryPromise(async () => {
				if (!engine.proxyUrl) {
					throw new Error("Start the forwarding proxy before sending a request.");
				}
				const url = new URL(path, engine.proxyUrl);
				url.hostname = hostname;
				const response = await fetch(url, init);
				return {
					body: await response.text(),
					cookies: response.headers.getSetCookie(),
					headers: Object.fromEntries(response.headers),
					status: response.status,
				};
			}),
		startProxy: (options: ForwardingProxyOptions = {}) =>
			Effect.gen(function* () {
				const proxy = yield* forwardingProxy(engine.upstream, options);
				engine.proxyUrl = proxy.url;
				return proxy.url;
			}),
		stopHost: () => Scope.close(engine.hostScope, Exit.void),
	}),
});
