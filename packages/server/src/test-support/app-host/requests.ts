import { request } from "node:http";
import { Effect, Result } from "effect";
import { answered, decodedErrorWords, resultOf } from "#test/answers.ts";
import { call, post } from "./fixture.ts";
import { createInvite } from "./invites.ts";
import { directPing, ping } from "./ping.ts";
import { postBody } from "./postBody.ts";
import { callPublicFailure } from "./publicFailureRpc.ts";
import { type HostState, io } from "./state.ts";

type Headers = Readonly<Record<string, string>>;

export function requests(state: HostState, tell: (line: string) => void) {
	function greet(token: string, reject: boolean, headers: Headers) {
		return io(() => call(state.url, token, reject, headers)).pipe(Effect.map((result) => resultOf(result, decodedErrorWords)));
	}
	function fetched(path: string, init?: RequestInit) {
		return io(async () => {
			const response = await fetch(`${state.url}${path}`, init);
			return { body: await response.text(), headers: response.headers, status: response.status };
		});
	}
	function recordedNdjson(body: string, chunked: boolean) {
		return io(async () => {
			const response = await postNdjson(state.url, body, chunked);
			state.response = { body: response.body, cacheControl: null, status: response.status };
			return response;
		});
	}
	return {
		callRpc: (tag: string, payload: unknown) => {
			tell(`a client calls the ${tag} RPC over NDJSON`);
			return recordedNdjson(`${JSON.stringify({ _tag: "Request", headers: [], id: "1", payload, tag })}\n`, false);
		},
		callRpcs: (calls: readonly { readonly id: string | number; readonly payload: unknown; readonly tag: string }[]) => {
			tell(`a client sends ${calls.map(({ id, tag }) => `${tag} as request ${id}`).join(", ")} in one NDJSON batch`);
			return recordedNdjson(calls.map((value) => `${JSON.stringify({ _tag: "Request", headers: [], ...value })}\n`).join(""), false);
		},
		createInvite: () => {
			tell("the native RPC client requests an invite code");
			return createInvite(state.url);
		},
		directPing: () => {
			tell("an independent native RPC server serves the shared group without host middleware");
			return directPing();
		},
		greet: (viewer: string, headers: Headers = {}) => {
			tell(`${viewer} calls the greeting RPC`);
			return greet(viewer, false, headers);
		},
		greetDuringSessionOutage: (headers: Headers = {}) => {
			tell("the greeting RPC arrives while the session store is unavailable");
			return greet("outage", false, headers);
		},
		greetSignedOut: (headers: Headers = {}) => {
			tell("a signed-out client calls the greeting RPC");
			return greet("", false, headers);
		},
		greetWithTakenName: (viewer: string, headers: Headers = {}) => {
			tell(`${viewer} calls the greeting RPC with a name that is taken`);
			return greet(viewer, true, headers);
		},
		health: () => {
			tell("the health monitor probes the host");
			return io(async () => {
				const response = await fetch(`${state.url}/health`, {
					headers: { origin: "https://health-monitor.example" },
					signal: AbortSignal.timeout(5000),
				});
				return { body: await response.text(), cacheControl: response.headers.get("cache-control"), status: response.status };
			});
		},
		httpAnswer: () => fetched("/").pipe(Effect.match({ onFailure: () => "refuses connections", onSuccess: () => "answers" })),
		ping: (options?: Parameters<typeof ping>[1]) => {
			tell(`the native RPC client pings ${state.rpcPath}`);
			return io(() => ping(`${state.url}${state.rpcPath}`, options));
		},
		pingOutcome: (options?: Parameters<typeof ping>[1]) => {
			tell(`the native RPC client pings ${state.rpcPath}${options?.authenticated ? " through the authenticated group" : ""}`);
			return answered(io(() => ping(`${state.url}${state.rpcPath}`, options)));
		},
		postBytes: (chunks: readonly Uint8Array[], options?: Parameters<typeof postBody>[3]) => {
			tell(`a keep-alive client posts ${chunks.reduce((total, chunk) => total + chunk.byteLength, 0)} body bytes`);
			return io(() => {
				if (state.agent === undefined) {
					throw new Error("Declare boundedBody before posting bytes");
				}
				return postBody(state.url, state.agent, chunks, options);
			});
		},
		postNdjson: (body: string, options: { readonly chunked?: boolean } = {}) => {
			tell(`a client posts ${Buffer.byteLength(body)} bytes of NDJSON to /rpc${options.chunked ? " in chunks" : ""}`);
			return recordedNdjson(body, options.chunked ?? false);
		},
		postRpc: (headers: Headers) => {
			tell(`a raw RPC post arrives with ${JSON.stringify(headers)}`);
			return io(async () => {
				const status = await post(state.url, headers);
				state.response = { cacheControl: null, status };
				return status;
			});
		},
		preflight: (path: string, method: string) => {
			tell(`https://reader.example sends a CORS preflight for ${method} ${path}`);
			return fetched(path, { headers: { "access-control-request-method": method, origin: "https://reader.example" }, method: "OPTIONS" }).pipe(
				Effect.map(({ headers, status }) => ({
					allowedMethods: headers.get("access-control-allow-methods"),
					allowedOrigin: headers.get("access-control-allow-origin"),
					status,
				})),
			);
		},
		publicFailure: (payload: Parameters<typeof callPublicFailure>[1]) => {
			tell("the native RPC client calls an RPC that fails with public data");
			return io(() => callPublicFailure(state.url, payload)).pipe(
				Effect.map((result) => (Result.isFailure(result) ? result.failure : "succeeded instead of failing")),
			);
		},
		publicFailureOnTheWire: (payload: Parameters<typeof callPublicFailure>[1]) => {
			tell("a raw NDJSON post calls the RPC that fails with public data");
			const message = { _tag: "Request", headers: [], id: "1", payload, tag: "publicFailure" };
			return io(() => postNdjson(state.url, `${JSON.stringify(message)}\n`, false)).pipe(Effect.map(({ body }) => body));
		},
		request: (path = "/", init?: RequestInit) => {
			tell(`${init?.method ?? "GET"} ${path}`);
			return fetched(path, init);
		},
	};
}

function postNdjson(url: string, body: string, chunked: boolean) {
	return new Promise<{ status: number; body: string }>((resolve, reject) => {
		const outgoing = request(
			`${url}/rpc`,
			{
				headers: {
					"content-type": "application/ndjson",
					...(chunked ? { "transfer-encoding": "chunked" } : { "content-length": Buffer.byteLength(body) }),
				},
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
		outgoing.write(body);
		outgoing.end();
	});
}
