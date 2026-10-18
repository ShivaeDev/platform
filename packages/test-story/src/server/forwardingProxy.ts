import { createServer, type RequestListener, request } from "node:http";
import { Effect } from "effect";
import { loopbackServer } from "#internal/loopback.ts";

export interface ForwardingProxyOptions {
	readonly headers?: Readonly<Record<string, string>>;
}

export const forwardingProxy = Effect.fnUntraced(function* (upstream: string, options: ForwardingProxyOptions = {}) {
	const forward: RequestListener = (incoming, response) => {
		const outgoing = request(
			`${upstream}${incoming.url}`,
			{
				headers: {
					...incoming.headers,
					"x-forwarded-for": [incoming.headers["x-forwarded-for"], incoming.socket.remoteAddress].filter(Boolean).join(", "),
					...options.headers,
				},
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
