import { createServer } from "node:http";

export async function otlpReceiver(status: number | ((attempt: number) => number) = 200, answer = "{}") {
	const requests: { body: string; bytes: Buffer; contentType: string | undefined; path: string | undefined; token: string | undefined }[] = [];
	const server = createServer(async (request, response) => {
		const chunks: Buffer[] = [];
		for await (const chunk of request) {
			chunks.push(Buffer.from(chunk));
		}
		const bytes = Buffer.concat(chunks);
		requests.push({
			body: bytes.toString(),
			bytes,
			contentType: request.headers["content-type"],
			path: request.url,
			token: request.headers["x-collector-token"]?.toString(),
		});
		response.writeHead(typeof status === "number" ? status : status(requests.length)).end(answer);
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
