import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Effect } from "effect";

export const startHost = Effect.gen(function* () {
	const visits: string[] = [];
	const signIns: unknown[] = [];
	const server = createServer(async (request, response) => {
		if (request.url === "/api/auth/sign-in/email") {
			await signIn(request, response, signIns);
			return;
		}
		visits.push(request.url ?? "");
		if (request.url === "/missing") {
			response.writeHead(404);
			response.end("Missing page");
			return;
		}
		response.setHeader("content-type", "text/html");
		let heading = "Local app";
		if (request.url === "/account") {
			heading = request.headers.cookie?.includes("session=alice") ? "Alice's account" : "Sign in";
		}
		response.end(`<html><body><h1>${heading}</h1></body></html>`);
	});
	yield* Effect.acquireRelease(
		Effect.promise(() => new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))),
		() => Effect.promise(() => new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))),
	);
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected TCP host");
	}
	return { signIns, url: `http://127.0.0.1:${address.port}`, visits };
});

async function signIn(request: IncomingMessage, response: ServerResponse, signIns: unknown[]) {
	const chunks: Buffer[] = [];
	for await (const chunk of request) {
		chunks.push(chunk);
	}
	const body = JSON.parse(Buffer.concat(chunks).toString());
	signIns.push(body);
	response.writeHead(body.email === "alice@example.com" && body.password === "alice-password" ? 200 : 401, {
		"content-type": "application/json",
		"set-cookie": "session=alice; Path=/; HttpOnly",
	});
	response.end("{}");
}
