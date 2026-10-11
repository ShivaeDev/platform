import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Options } from "#model.ts";
export interface Reply {
	readonly body: unknown;
	readonly headers?: Record<string, string>;
	readonly status?: number;
}
interface PullFixture {
	"auto_merge": Record<string, unknown> | null;
	head: {
		ref: string;
		sha: string;
	};
	mergeable: boolean | null;
	"mergeable_state": string;
	merged: boolean;
	number: number;
	state: string;
	title: string;
}
export function pull(number = 1): PullFixture {
	return {
		"auto_merge": { "merge_method": "squash" },
		head: { ref: `feature-${number}`, sha: `sha${number}` },
		mergeable: true,
		"mergeable_state": "clean",
		merged: false,
		number,
		state: "open",
		title: `Change ${number}`,
	};
}
export async function startServer() {
	const directory = await mkdtemp(join(tmpdir(), "pr-watch-"));
	const routes = new Map<string, Reply>();
	const requests: {
		path: string;
		etag: string | undefined;
		status: number;
		authorization: string | undefined;
	}[] = [];
	const server = createServer((request, response) => {
		const path = request.url ?? "";
		const reply = routes.get(path) ?? { body: {}, status: 404 };
		const etag = `"${JSON.stringify([reply.body, reply.headers?.link])
			.replaceAll('"', "")
			.replaceAll(/[^\x20-\x7e]/gu, "")}"`;
		const status = reply.status ?? (request.headers["if-none-match"] === etag ? 304 : 200);
		requests.push({ authorization: request.headers.authorization, etag: request.headers["if-none-match"], path, status });
		response.writeHead(status, { "content-type": "application/json", etag, ...reply.headers });
		response.end(status === 304 ? undefined : JSON.stringify(reply.body));
	});
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (address === null || typeof address === "string") {
		throw new Error("Expected a TCP address");
	}
	const options: {
		-readonly [TKey in keyof Options]: Options[TKey];
	} = {
		apiUrl: `http://127.0.0.1:${address.port}`,
		fleet: false,
		interval: 60_000,
		numbers: [1],
		repository: "acme/project",
		stateFile: join(directory, "state.json"),
		token: "test-token",
	};
	function set(path: string, reply: Reply) {
		return routes.set(`/repos/acme/project${path}`, reply);
	}
	function setPull(number: number, changes: Partial<ReturnType<typeof pull>> = {}) {
		set(`/pulls/${number}`, { body: { ...pull(number), ...changes } });
		set(`/commits/sha${number}/check-runs?per_page=100&filter=latest`, { body: { "check_runs": [] } });
		set(`/commits/sha${number}/status`, { body: { state: "success" } });
	}
	setPull(1);
	set("/git/matching-refs/heads/gh-readonly-queue/", { body: [] });
	set("/pulls?state=open&per_page=100", { body: [{ number: 1 }] });
	return {
		close: async () => {
			server.closeAllConnections();
			await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
			await rm(directory, { force: true, recursive: true });
		},
		options,
		requests,
		set,
		setPull,
	};
}
