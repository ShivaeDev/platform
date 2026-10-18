import { createHash } from "node:crypto";
import { Effect, Layer } from "effect";
import { GithubApi } from "#host/githubApi.ts";
import { GithubTransport, ghTransport } from "#host/githubTransport.ts";
import { githubCli } from "#test/githubCli.ts";

export const GITHUB_RESET = 1_800_003_600;

export interface ScriptedGithubResponse {
	readonly body: unknown;
	readonly headers?: Readonly<Record<string, string>>;
	readonly status?: number;
}

export function httpOutput(status: number, headers: Readonly<Record<string, string>>, body: string) {
	return `HTTP/2.0 ${status} Synthetic\r\n${Object.entries(headers)
		.map(([name, value]) => `${name}: ${value}\r\n`)
		.join("")}\r\n${body}`;
}

export interface GithubRequest {
	readonly endpoint: string;
	readonly etag: string | undefined;
	readonly status: number;
}

interface SyntheticBudget {
	limit: number;
	remaining: number;
	reset: number;
}

function conditionalEtag(args: readonly string[]) {
	const header = args.indexOf("--header");
	return header < 0 ? undefined : args[header + 1]?.replace(/^If-None-Match: /u, "");
}

function rateHeaders(budget: SyntheticBudget) {
	return {
		"X-Ratelimit-Limit": String(budget.limit),
		"X-Ratelimit-Remaining": String(budget.remaining),
		"X-Ratelimit-Reset": String(budget.reset),
		"X-Ratelimit-Resource": "core",
		"X-Ratelimit-Used": String(budget.limit - budget.remaining),
	};
}

function spend(budget: SyntheticBudget, scripted: number, unchanged: boolean) {
	if (scripted === 200 && unchanged) {
		return 304;
	}
	if (scripted !== 304 && budget.remaining > 0) {
		budget.remaining -= 1;
	}
	return scripted;
}

export function syntheticGithub(options: { readonly limit?: number; readonly remaining?: number; readonly reset?: number } = {}) {
	const budget: SyntheticBudget = { limit: options.limit ?? 5000, remaining: options.remaining ?? 5000, reset: options.reset ?? GITHUB_RESET };
	const responses = new Map<string, ScriptedGithubResponse>();
	const requests: GithubRequest[] = [];
	function respond(args: readonly string[]) {
		const endpoint = args.at(-1) ?? "";
		const etag = conditionalEtag(args);
		const scripted = responses.get(endpoint) ?? { body: { message: "Not Found" }, status: 404 };
		const body = typeof scripted.body === "string" ? scripted.body : JSON.stringify(scripted.body);
		const current = `"${createHash("sha256").update(body).digest("hex")}"`;
		const status = spend(budget, scripted.status ?? 200, etag === current);
		requests.push({ endpoint, etag, status });
		const headers = { ...rateHeaders(budget), ...(status === 200 ? { Etag: current } : {}), ...scripted.headers };
		return { exitCode: status >= 200 && status <= 299 ? 0 : 1, output: httpOutput(status, headers, status === 304 ? "" : body) };
	}
	const transport = Layer.succeed(GithubTransport, (args: readonly string[]) => Effect.sync(() => respond(args)));
	return {
		budget,
		layer: GithubApi.layer.pipe(Layer.provide(transport)),
		reply: (endpoint: string, body: unknown, response: Omit<ScriptedGithubResponse, "body"> = {}) => {
			responses.set(endpoint, { body, ...response });
		},
		requests,
	};
}

export function githubCliApi(bodies: ReadonlyMap<string, string>, status = 200) {
	const cli = githubCli(
		new Map([...bodies].map(([endpoint, body]) => [endpoint, httpOutput(status, { Etag: `"${endpoint}"` }, body)])),
		status >= 200 && status <= 299 ? 0 : 1,
	);
	return { commands: cli.commands, layer: GithubApi.layer.pipe(Layer.provide(ghTransport.pipe(Layer.provide(cli.layer)))) };
}

export function unslurped(responses: ReadonlyMap<string, string>) {
	return new Map(
		[...responses].map(([endpoint, pages]) => {
			const [page, ...rest] = JSON.parse(pages);
			if (rest.length > 0) {
				throw new Error(`Synthetic ${endpoint} needs Link headers for more than one page`);
			}
			return [endpoint, JSON.stringify(page)];
		}),
	);
}
