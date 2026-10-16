import { once } from "node:events";
import { createServer, request } from "node:http";

export async function forwardingProxy(upstream: string) {
	const server = createServer((incoming, response) => {
		const outgoing = request(
			`${upstream}${incoming.url}`,
			{
				headers: { ...incoming.headers, host: "internal.test", "x-forwarded-host": "app.example", "x-forwarded-proto": "https" },
				method: incoming.method,
			},
			(result) => {
				response.writeHead(result.statusCode ?? 502, result.headers);
				result.pipe(response);
			},
		);
		outgoing.on("error", () => {
			response.writeHead(502);
			response.end();
		});
		incoming.pipe(outgoing);
	});
	server.listen(0, "127.0.0.1");
	await once(server, "listening");
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected proxy TCP address");
	}
	return {
		close: () =>
			new Promise<void>((resolve, reject) => {
				server.closeAllConnections();
				server.close((error) => (error === undefined ? resolve() : reject(error)));
			}),
		url: `http://127.0.0.1:${address.port}`,
	};
}
