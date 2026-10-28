import { createHash } from "node:crypto";
import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { type FakeHttpReply, type FakeHttpRequest, fakeHttpService } from "@shivaedev/test-story/server/fakeHttpService.ts";

export interface ScriptedGithubResponse {
	readonly body: unknown;
	readonly headers?: Readonly<Record<string, string>>;
	readonly status?: number;
}
export interface GithubRequest {
	readonly endpoint: string;
	readonly etag: string | undefined;
	readonly method: string;
	readonly status: number;
}

function rateHeaders(budget: { limit: number; remaining: number; reset: number }) {
	return {
		"x-ratelimit-limit": String(budget.limit),
		"x-ratelimit-remaining": String(budget.remaining),
		"x-ratelimit-reset": String(budget.reset),
		"x-ratelimit-resource": "core",
		"x-ratelimit-used": String(budget.limit - budget.remaining),
	};
}

function spend(budget: { remaining: number }, scripted: number, unchanged: boolean) {
	if (scripted === HttpStatus.fromLiteral("OK") && unchanged) {
		return HttpStatus.fromLiteral("NotModified");
	}
	if (scripted !== HttpStatus.fromLiteral("NotModified") && budget.remaining > 0) {
		budget.remaining -= 1;
	}
	return scripted;
}

export function fakeGitHub(options: { readonly limit?: number; readonly remaining?: number; readonly reset?: number } = {}) {
	const budget = { limit: options.limit ?? 5000, remaining: options.remaining ?? 5000, reset: options.reset ?? 1_800_003_600 };
	const responses = new Map<string, { endpoint: string; response: ScriptedGithubResponse }>();
	const requests: GithubRequest[] = [];
	function path(endpoint: string) {
		const url = new URL(endpoint, "https://api.github.com");
		return `${url.pathname}${url.search}`;
	}
	function respond(request: FakeHttpRequest, origin: string): FakeHttpReply {
		const entry = responses.get(request.path);
		const scripted = entry?.response ?? { body: { message: "Not Found" }, status: HttpStatus.fromLiteral("NotFound") };
		const body = typeof scripted.body === "string" ? scripted.body : JSON.stringify(scripted.body);
		const current = `"${createHash("sha256").update(body).digest("hex")}"`;
		const etag = request.headers["if-none-match"]?.toString();
		const status = spend(budget, scripted.status ?? HttpStatus.fromLiteral("OK"), etag === current);
		requests.push({ endpoint: entry?.endpoint ?? request.path.slice(1), etag, method: request.method, status });
		const overrides = Object.fromEntries(
			Object.entries(scripted.headers ?? {}).map(([name, value]) => [name.toLowerCase(), value.replaceAll("https://api.github.com", origin)]),
		);
		const headers = { ...rateHeaders(budget), ...(status === HttpStatus.fromLiteral("OK") ? { etag: current } : {}), ...overrides };
		return { chunks: status === HttpStatus.fromLiteral("NotModified") ? [] : [body], headers, status };
	}
	const serve = Effect.gen(function* () {
		const server = yield* fakeHttpService({ routes: { api: { path: "/:path*", reply: (request): FakeHttpReply => respond(request, server.url) } } });
		return server;
	});
	return {
		budget,
		reply: (endpoint: string, body: unknown, response: Omit<ScriptedGithubResponse, "body"> = {}) => {
			responses.set(path(endpoint), { endpoint, response: { body, ...response } });
		},
		requests,
		serve,
	};
}
