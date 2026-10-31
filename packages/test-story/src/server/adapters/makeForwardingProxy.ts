import { createServer, type IncomingMessage, request } from "node:http";
import { isIP } from "node:net";
import * as HttpStatus from "effect/http/HttpStatus";
import type { ForwardingProxyOptions } from "#forwardingProxy.ts";
import { proxyConnections } from "./proxyConnections.ts";

export function makeForwardingProxy(upstream: string, options: ForwardingProxyOptions) {
	const connections = proxyConnections();
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
	const server = createServer((incoming, response) => {
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
	})
		.on("connection", connections.track)
		.on("upgrade", (incoming, downstream, head) => {
			const outgoing = request(`${upstream}${incoming.url}`, requestOptions(incoming));
			outgoing.on("upgrade", (result, upstreamSocket, upstreamHead) => {
				downstream.write(`HTTP/1.1 ${result.statusCode} ${result.statusMessage}\r\n`);
				for (let index = 0; index < result.rawHeaders.length; index += 2) {
					downstream.write(`${result.rawHeaders[index]}: ${result.rawHeaders[index + 1]}\r\n`);
				}
				downstream.write("\r\n");
				connections.upgrade(downstream, upstreamSocket, head, upstreamHead);
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
	return { ...connections, server };
}
