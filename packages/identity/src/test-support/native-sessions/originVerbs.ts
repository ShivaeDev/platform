import { Effect } from "effect";
import * as HttpStatus from "effect/http/HttpStatus";
import { countWords } from "@shivaedev/test/answers.ts";
import type { Host } from "./host.ts";
import { mintSession } from "./mint.ts";
import { openServerStreams, originStream } from "./originStream.ts";

export interface OriginRequest {
	readonly bearer?: boolean;
	readonly contentType?: string;
	readonly cookie?: boolean;
	readonly messageCredentials?: boolean;
	readonly messageOrigin?: string;
	readonly origin?: string;
	readonly sameOrigin?: boolean;
}

interface Answered {
	readonly body: string;
	readonly headers: Headers;
	readonly status: number;
}

function corsOf(headers: Headers) {
	return {
		allowOrigin: headers.get("access-control-allow-origin") ?? "none",
		credentials: headers.get("access-control-allow-credentials") === null ? "not allowed" : "allowed",
		exposed: headers.get("access-control-expose-headers") ?? "none",
		vary: (headers.get("vary") ?? "").includes("Origin") ? "Origin" : "none",
	};
}

function requestWords(request: OriginRequest) {
	return Object.entries(request)
		.map(([key, value]) => (value === true ? key : `${key} ${String(value)}`))
		.join(", ");
}

function messageHeadersOf(request: OriginRequest, credential: string, cookie: string) {
	const credentials = request.messageCredentials
		? [
				["authorization", `Bearer ${credential}`],
				["cookie", cookie],
			]
		: [];
	return [...credentials, ...(request.messageOrigin === undefined ? [] : [["origin", request.messageOrigin]])];
}

function profileWords(answer: Answered, email: string) {
	if (answer.status === HttpStatus.fromLiteral("Forbidden")) {
		return `forbidden: ${answer.body}`;
	}
	if (answer.body.includes(email)) {
		return "answered with the profile";
	}
	return answer.body.includes('"_tag":"Unauthorized"') ? "failed with unauthorized" : `unexpected answer ${answer.status} ${answer.body}`;
}

export function originVerbs(host: Host, tell: (line: string) => void) {
	let session: Effect.Success<ReturnType<typeof mintSession>> | undefined;
	let last: Answered | undefined;
	let stream: Effect.Success<ReturnType<typeof originStream>> | undefined;
	const minted = Effect.suspend(() => {
		if (session !== undefined) {
			return Effect.succeed(session);
		}
		return Effect.tap(mintSession(host), (value) =>
			Effect.sync(() => {
				session = value;
			}),
		);
	});
	function send(path: string, init: RequestInit) {
		return Effect.promise(async () => {
			const response = await fetch(`${host.baseUrl}${path}`, { ...init, credentials: "omit", signal: AbortSignal.timeout(5000) });
			last = { body: await response.text(), headers: response.headers, status: response.status };
			return last;
		});
	}
	function headersOf(request: OriginRequest, credential: string, cookie: string): Record<string, string> {
		return {
			...(request.origin === undefined ? {} : { origin: request.origin }),
			...(request.sameOrigin ? { origin: host.baseUrl } : {}),
			...(request.bearer ? { authorization: `Bearer ${credential}` } : {}),
			...(request.cookie ? { cookie } : {}),
		};
	}
	return {
		authSession: (request: OriginRequest) =>
			Effect.gen(function* () {
				tell(`a client with ${requestWords(request)} reads its session through the auth route`);
				const { cookie, credential, user } = yield* minted;
				const answer = yield* send("/api/auth/get-session", { headers: headersOf(request, credential, cookie) });
				if (answer.status === HttpStatus.fromLiteral("Forbidden")) {
					return `forbidden: ${answer.body}`;
				}
				if (answer.body.includes(user.id)) {
					return "the native user";
				}
				return answer.body === "null" ? "no session" : `unexpected session ${answer.body}`;
			}),
		hostResyncs: () => {
			tell("the host resyncs its live streams");
			return Effect.map(openServerStreams(host), (count) => countWords(count, "open stream"));
		},
		lastCors: () => Effect.sync(() => (last === undefined ? "no response yet" : corsOf(last.headers))),
		nativeStreamIsInterrupted: () => {
			tell("the native client interrupts its subscription");
			return stream === undefined ? Effect.void : stream.interrupt;
		},
		nativeStreamOpens: (origin: string) =>
			Effect.gen(function* () {
				tell(`a native WebSocket client at ${origin} subscribes to changes with its bearer and receives the first update`);
				const { credential } = yield* minted;
				stream = yield* originStream(host, origin, credential);
				return yield* stream.next;
			}),
		nextUpdate: () => (stream === undefined ? Effect.succeed("no stream") : stream.next),
		openServerStreams: () => Effect.map(openServerStreams(host), (count) => countWords(count, "open stream")),
		preflight: (path: string, origin: string) =>
			Effect.gen(function* () {
				tell(`${origin} sends a CORS preflight for POST ${path}`);
				const answer = yield* send(path, {
					headers: { "access-control-request-headers": "authorization, content-type", "access-control-request-method": "POST", origin },
					method: "OPTIONS",
				});
				return {
					allowHeaders: answer.headers.get("access-control-allow-headers") ?? "none",
					allowMethods: answer.headers.get("access-control-allow-methods") ?? "none",
					...corsOf(answer.headers),
					status: answer.status,
				};
			}),
		profile: (request: OriginRequest) =>
			Effect.gen(function* () {
				tell(`a client with ${requestWords(request)} reads the profile through RPC`);
				const { cookie, credential, user } = yield* minted;
				const headers = messageHeadersOf(request, credential, cookie);
				const answer = yield* send("/rpc", {
					body: `${JSON.stringify({ _tag: "Request", headers, id: "0", payload: { owner: user.id }, tag: "native.profile" })}\n`,
					headers: { "content-type": request.contentType ?? "application/ndjson", ...headersOf(request, credential, cookie) },
					method: "POST",
				});
				return profileWords(answer, user.email);
			}),
		sessionLookups: () => Effect.sync(() => host.activity.lookups),
	};
}
