import { createServer } from "node:http";

export async function otlpReceiver(status = 200) {
	const requests: { body: string; path: string | undefined; token: string | undefined }[] = [];
	const server = createServer(async (request, response) => {
		const chunks: Buffer[] = [];
		for await (const chunk of request) {
			chunks.push(Buffer.from(chunk));
		}
		requests.push({ body: Buffer.concat(chunks).toString(), path: request.url, token: request.headers["x-collector-token"]?.toString() });
		response.writeHead(status).end("{}");
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Missing receiver address");
	}
	return {
		close: () => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
		requests,
		url: `http://127.0.0.1:${address.port}`,
	};
}
