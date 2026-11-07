import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as HttpStatus from "effect/http/HttpStatus";
import type { Received } from "#test/githubModel.ts";
import { githubReplies } from "#test/githubReplies.ts";
import { makeGitHubState } from "#test/githubState.ts";
import { serverSignals } from "#test/serverSignals.ts";

export async function startServer(now: () => number) {
	const directory = await mkdtemp(join(tmpdir(), "pr-watch-"));
	const state = makeGitHubState();
	const replyTo = githubReplies(state);
	const requests: Received[] = [];
	const signals = serverSignals();
	const server = createServer(async (request, response) => {
		const chunks: Uint8Array[] = [];
		for await (const chunk of request) {
			chunks.push(chunk);
		}
		const text = Buffer.concat(chunks).toString();
		const body = text === "" ? undefined : JSON.parse(text);
		const path = request.url ?? "";
		const reply = replyTo(path, body);
		const etag = `"${JSON.stringify([reply.body, reply.headers?.link])
			.replaceAll('"', "")
			.replaceAll(/[^\x20-\x7e]/gu, "")}"`;
		const unchanged = reply.status === undefined && request.headers["if-none-match"] === etag;
		const status = reply.status ?? (unchanged ? HttpStatus.fromLiteral("NotModified") : HttpStatus.fromLiteral("OK"));
		requests.push({ at: now(), authorization: request.headers.authorization, body, method: request.method ?? "GET", path, status });
		await signals.arrive(path);
		response.writeHead(status, { "content-type": "application/json", etag, ...reply.headers });
		response.end(unchanged ? undefined : JSON.stringify(reply.body));
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP address");
	}
	return {
		...state,
		...signals,
		apiUrl: `http://127.0.0.1:${address.port}`,
		close: async () => {
			signals.releaseAll();
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
			await rm(directory, { force: true, recursive: true });
		},
		directory,
		requests,
	};
}

export type FakeGitHub = Awaited<ReturnType<typeof startServer>>;
