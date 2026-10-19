import { createServer, type RequestListener, request } from "node:http";
import { isIP } from "node:net";
import { Effect } from "effect";
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
	const forward: RequestListener = (incoming, response) => {
		const outgoing = request(
			`${upstream}${incoming.url}`,
			{
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
			},
			(result) => {
				response.writeHead(result.statusCode ?? 502, result.headers);
				result.pipe(response);
			},
		);
		outgoing.on("error", (error) => {
			if (response.headersSent) {
				response.destroy(error);
			} else {
				response.writeHead(502).end();
			}
		});
		response.on("close", () => outgoing.destroy());
		incoming.pipe(outgoing);
	};
	const url = yield* loopbackServer(createServer(forward));
	yield* loopbackServer(createServer(forward), { host: "::1", port: Number(new URL(url).port) });
	return { url };
});
