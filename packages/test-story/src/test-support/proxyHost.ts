import { createServer } from "node:http";
import { Effect, Exit, Scope } from "effect";
import { forwardingProxy } from "#forwardingProxy.ts";
import { loopbackServer } from "#internal/loopback.ts";
import { storyKit } from "#storyKit.ts";

export const proxyHost = storyKit({
	clock: "live",
	*create() {
		const hostScope = yield* Scope.fork(yield* Scope.Scope);
		const host = createServer(async (request, response) => {
			const chunks: Buffer[] = [];
			for await (const chunk of request) {
				chunks.push(Buffer.from(chunk));
			}
			response.writeHead(201, { "content-type": "application/json", "set-cookie": ["first=one", "second=two"], "x-host": "reached" });
			response.end(JSON.stringify({ body: Buffer.concat(chunks).toString(), headers: request.headers, method: request.method, path: request.url }));
		});
		const upstream = yield* loopbackServer(host).pipe(Effect.provideService(Scope.Scope, hostScope));
		return { hostScope, proxyUrl: "", upstream };
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
		startProxy: (headers: Readonly<Record<string, string>> = {}) =>
			Effect.gen(function* () {
				const proxy = yield* forwardingProxy(engine.upstream, { headers });
				engine.proxyUrl = proxy.url;
				return proxy.url;
			}),
		stopHost: () => Scope.close(engine.hostScope, Exit.void),
	}),
});
