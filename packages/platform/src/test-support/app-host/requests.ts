import { request } from "node:http";
import { call, post } from "./fixture.ts";
import { ping } from "./ping.ts";
import { postBody } from "./postBody.ts";
import { type HostState, io } from "./state.ts";

export function requests(state: HostState, tell: (line: string) => void) {
	return {
		call: (token: string, reject = false, headers: Readonly<Record<string, string>> = {}) => {
			tell(`the fixture RPC is called as ${token || "anonymous"}`);
			return io(() => call(state.url, token, reject, headers));
		},
		health: () => {
			tell("the health monitor probes PostgreSQL");
			return io(async () => {
				const response = await fetch(`${state.url}/health`, {
					headers: { origin: "https://health-monitor.example" },
					signal: AbortSignal.timeout(5000),
				});
				return { body: await response.text(), cacheControl: response.headers.get("cache-control"), status: response.status };
			});
		},
		ping: () => {
			tell("the native RPC client pings the host");
			return io(() => ping(`${state.url}${state.rpcPath}`));
		},
		post: (headers: Readonly<Record<string, string>>) => io(() => post(state.url, headers)),
		postBytes: (chunks: readonly Uint8Array[], options?: Parameters<typeof postBody>[3]) =>
			io(() => {
				if (state.agent === undefined) {
					throw new Error("The body reader needs a keep-alive client");
				}
				return postBody(state.url, state.agent, chunks, options);
			}),
		postNdjson: (body: string, chunked: boolean) => io(() => postNdjson(state.url, body, chunked)),
		request: (path = "/", init?: RequestInit) => {
			tell(`${init?.method ?? "GET"} ${path}`);
			return io(async () => {
				const response = await fetch(`${state.url}${path}`, init);
				return { body: await response.text(), headers: response.headers, status: response.status };
			});
		},
	};
}

function postNdjson(url: string, body: string, chunked: boolean) {
	return new Promise<{ status: number; body: string }>((resolve, reject) => {
		const outgoing = request(
			`${url}/rpc`,
			{
				headers: { "content-type": "application/ndjson", ...(chunked ? {} : { "content-length": Buffer.byteLength(body) }) },
				method: "POST",
			},
			(response) => {
				let received = "";
				response.setEncoding("utf8");
				response.on("data", (chunk: string) => {
					received += chunk;
				});
				response.on("end", () => resolve({ body: received, status: response.statusCode ?? 0 }));
			},
		);
		outgoing.on("error", reject);
		outgoing.end(body);
	});
}
