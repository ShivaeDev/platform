import { createServer, type IncomingMessage, type RequestListener, request } from "node:http";
import { isIP } from "node:net";
import type { Duplex } from "node:stream";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { loopbackServer } from "#internal/loopback.ts";

export interface ForwardingProxyOptions {
	readonly forwardedHops?: readonly string[];
	readonly headers?: Readonly<Record<string, string>>;
	readonly localAddress?: string;
}

export const forwardingProxy = Effect.fnUntraced(function* (upstream: string, options: ForwardingProxyOptions = {}) {
	if (options.localAddress !== undefined) {
		yield* Effect.scoped(loopbackServer(createServer(), { host: options.localAddress })).pipe(
			Effect.mapError((cause) => new Error(`Cannot acquire forwarding proxy with local address ${options.localAddress}`, { cause })),
		);
	}
	function requestOptions(incoming: IncomingMessage) {
		return {
			family: options.localAddress === undefined ? undefined : isIP(options.localAddress),
			headers: {
				...incoming.headers,
				"x-forwarded-for": [incoming.headers["x-forwarded-for"], ...(options.forwardedHops ?? [incoming.socket.remoteAddress])]
					.filter(Boolean)
					.join(", "),
				...options.headers,
			},
			localAddress: options.localAddress,
			method: incoming.method,
		};
	}
	const forward: RequestListener = (incoming, response) => {
		const outgoing = request(`${upstream}${incoming.url}`, requestOptions(incoming), (result) => {
			response.writeHead(result.statusCode ?? HttpStatus.fromLiteral("BadGateway"), result.headers);
			result.pipe(response);
		});
		outgoing.on("error", (error) => {
			if (response.headersSent) {
				response.destroy(error);
			} else {
				response.writeHead(HttpStatus.fromLiteral("BadGateway")).end();
			}
		});
		response.on("close", () => outgoing.destroy());
		incoming.pipe(outgoing);
	};
	const sockets = new Set<Duplex>();
	function server() {
		return createServer(forward).on("upgrade", (incoming, downstream, head) => {
			sockets.add(downstream);
			downstream.on("close", () => sockets.delete(downstream));
			const outgoing = request(`${upstream}${incoming.url}`, requestOptions(incoming));
			outgoing.on("upgrade", (result, upstreamSocket, upstreamHead) => {
				downstream.write(`HTTP/1.1 ${result.statusCode} ${result.statusMessage}\r\n`);
				for (let index = 0; index < result.rawHeaders.length; index += 2) {
					downstream.write(`${result.rawHeaders[index]}: ${result.rawHeaders[index + 1]}\r\n`);
				}
				downstream.write("\r\n");
				downstream.write(upstreamHead);
				upstreamSocket.write(head);
				downstream.pipe(upstreamSocket).pipe(downstream);
				downstream.on("close", () => upstreamSocket.destroy());
				upstreamSocket.on("error", () => downstream.destroy());
			});
			outgoing.on("response", (result) => {
				downstream.end(`HTTP/1.1 ${result.statusCode} ${result.statusMessage}\r\nConnection: close\r\n\r\n`);
				result.resume();
			});
			outgoing.on("error", () => downstream.destroy());
			downstream.on("error", () => outgoing.destroy());
			downstream.on("close", () => outgoing.destroy());
			outgoing.end();
		});
	}
	const url = yield* loopbackServer(server());
	yield* loopbackServer(server(), { host: "::1", port: Number(new URL(url).port) });
	yield* Effect.addFinalizer(() =>
		Effect.sync(() => {
			for (const socket of sockets) {
				socket.destroy();
			}
		}),
	);
	return { url };
});
