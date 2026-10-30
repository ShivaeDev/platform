import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Clock, Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import type { Options } from "#model.ts";
import { type QueuePull, queueReply } from "./queue.ts";
import { requiredChecks } from "./requiredChecks.ts";
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
	const required = requiredChecks();
	const queueEntries = new Map<number, QueuePull>();
	const requests: {
		at: number;
		path: string;
		method: string | undefined;
		body: unknown;
		etag: string | undefined;
		status: number;
		authorization: string | undefined;
	}[] = [];
	function defaultReply(path: string, body: { query: string; variables: { number: number; sha?: string; after?: string } } | undefined): Reply {
		if (!path.endsWith("/graphql") || body === undefined) {
			return { body: {}, status: HttpStatus.fromLiteral("NotFound") };
		}
		if (body.query.includes("query RequiredChecks")) {
			return required.reply(body.variables.sha ?? "", body.variables.after ?? null);
		}
		return queueReply(body, queueEntries);
	}
	const server = createServer(async (request, response) => {
		const chunks: Uint8Array[] = [];
		for await (const chunk of request) {
			chunks.push(chunk);
		}
		const text = Buffer.concat(chunks).toString();
		const body = text === "" ? undefined : JSON.parse(text);
		const path = request.url ?? "";
		const route = path === "/api/graphql" ? "/graphql" : path.replace(/^\/api\/v3/u, "");
		const reply = routes.get(route) ?? defaultReply(path, body);
		const etag = `"${JSON.stringify([reply.body, reply.headers?.link])
			.replaceAll('"', "")
			.replaceAll(/[^\x20-\x7e]/gu, "")}"`;
		const unchanged = reply.status === undefined && request.headers["if-none-match"] === etag;
		const status = reply.status ?? (unchanged ? HttpStatus.fromLiteral("NotModified") : HttpStatus.fromLiteral("OK"));
		requests.push({
			at: Effect.runSync(Clock.currentTimeMillis),
			authorization: request.headers.authorization,
			body,
			etag: request.headers["if-none-match"],
			method: request.method,
			path,
			status,
		});
		response.writeHead(status, { "content-type": "application/json", etag, ...reply.headers });
		response.end(unchanged ? undefined : JSON.stringify(reply.body));
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
	};
	function set(path: string, reply: Reply) {
		return routes.set(`/repos/acme/project${path}`, reply);
	}
	function setPull(number: number, changes: Partial<ReturnType<typeof pull>> = {}) {
		const pr = { ...pull(number), ...changes };
		set(`/pulls/${number}`, { body: pr });
		queueEntries.set(number, {
			autoMergeRequest: pr.auto_merge === null ? null : { enabledAt: "2026-01-01T00:00:00Z" },
			mergeQueueEntry: null,
			state: pr.merged ? "MERGED" : pr.state.toUpperCase(),
			timelineItems: { nodes: [] },
		});
		required.seed(pr.head.sha);
		const checks = `/commits/${pr.head.sha}/check-runs?per_page=100&filter=latest`;
		const status = `/commits/${pr.head.sha}/status`;
		if (!routes.has(`/repos/acme/project${checks}`)) {
			set(checks, { body: { "check_runs": [] } });
		}
		if (!routes.has(`/repos/acme/project${status}`)) {
			set(status, { body: { state: "success", statuses: [] } });
		}
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
		requirements: required.nodes,
		set,
		setGraphql: (reply: Reply) => routes.set("/graphql", reply),
		setPull,
		setQueue: (number: number, autoMerge: boolean, queued: boolean, reason?: string) =>
			queueEntries.set(number, {
				autoMergeRequest: autoMerge ? { enabledAt: "2026-01-01T00:00:00Z" } : null,
				mergeQueueEntry: queued ? { id: `entry-${number}` } : null,
				state: "OPEN",
				timelineItems: { nodes: reason === undefined ? [] : [{ reason }] },
			}),
		setRequiredPage: required.setPage,
	};
}
