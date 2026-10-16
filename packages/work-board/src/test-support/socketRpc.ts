import { renameSync } from "node:fs";
import { request } from "node:http";
import { createServer } from "node:net";

function frames(body: string): readonly unknown[] {
	return body
		.trim()
		.split("\n")
		.map((line): unknown => JSON.parse(line));
}

export function socketRpc(address: string, tag: string): Promise<readonly unknown[]> {
	return new Promise((resolve, reject) => {
		const tcp = address.startsWith("http:");
		const url = new URL("/_board/rpc", tcp ? address : "http://localhost");
		const outgoing = request(
			url,
			{
				...(tcp ? {} : { socketPath: address }),
				headers: { "content-type": "application/ndjson", host: "localhost" },
				method: "POST",
			},
			(response) => {
				let body = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					body += chunk;
				});
				response.on("end", () => {
					try {
						resolve(frames(body));
					} catch (error) {
						reject(error);
					}
				});
			},
		);
		outgoing.on("error", reject);
		outgoing.end(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload: null, tag })}\n`);
	});
}

export function staleSocket(path: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.on("error", reject);
		server.listen(`${path}.stale`, () => {
			renameSync(`${path}.stale`, path);
			server.close((error) => (error ? reject(error) : resolve()));
		});
	});
}
