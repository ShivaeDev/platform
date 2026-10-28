import { Effect, Option } from "effect";
import { Headers, HttpServerRequest, HttpServerResponse } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import { RpcSerialization } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { localRpcGuard, loopbackOnly, sameOrigin, trustedProxyRanges } from "#server/local.ts";
import { transportHeaders } from "#server/transportHeaders.ts";

const forwarded = {
	"content-type": "application/ndjson",
	host: "internal.test",
	origin: "https://app.example",
	"x-forwarded-host": "app.example",
	"x-forwarded-proto": "https",
};

const local = { "content-type": "application/ndjson", host: "localhost" };

type Answer = "served" | "forbidden" | `inconsistent: ${string}`;

function answerOf(calls: number, status: number): Answer {
	if (calls === 1 && status === HttpStatus.fromLiteral("NoContent")) {
		return "served";
	}
	if (calls === 0 && status === HttpStatus.fromLiteral("Forbidden")) {
		return "forbidden";
	}
	return `inconsistent: ${calls} handler calls and HTTP ${status}`;
}

const guard = Effect.fnUntraced(function* (trust: string | undefined, address: string | undefined, headers: Readonly<Record<string, string>>) {
	let calls = 0;
	const request = HttpServerRequest.fromWeb(new Request("http://internal.test/rpc", { headers })).modify({
		remoteAddress: Option.fromNullishOr(address),
	});
	const response = yield* localRpcGuard(
		Effect.sync(() => {
			calls += 1;
			return HttpServerResponse.empty();
		}),
		trust,
	).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request), Effect.provide(RpcSerialization.layerNdjson));
	return answerOf(calls, response.status);
});

function pageRequest(headers: Readonly<Record<string, string>>) {
	return HttpServerRequest.fromWeb(new Request("http://localhost/", { headers: { host: "localhost", ...headers } }));
}

export const transport = storyKit({
	create: (): { trust: string | undefined } => ({ trust: undefined }),
	name: "RPC transport",
	stages: ["configured"],
	verbs: (state, story) => ({
		forwardedRequestFrom: (address: string | undefined, changes: Readonly<Record<string, string>> = {}, removed: readonly string[] = []) => {
			const headers = Object.fromEntries(Object.entries({ ...forwarded, ...changes }).filter(([name]) => !removed.includes(name)));
			story.tell(
				`a request from ${address ?? "an unknown peer"} forwarded for https://app.example reaches the RPC guard with ${JSON.stringify(headers)}`,
			);
			return guard(state.trust, address, headers);
		},
		localRequestFrom: (address: string | undefined) => {
			story.tell(`a same-origin request to localhost from ${address ?? "an unknown peer"} reaches the RPC guard`);
			return guard(state.trust, address, local);
		},
		loopbackPageWithoutAddress: () =>
			Effect.gen(function* () {
				story.tell("a Fetch page request to localhost without a transport address reaches the loopback-only handler");
				const response = yield* loopbackOnly(() => Effect.succeed(HttpServerResponse.empty()))(pageRequest({}));
				return response.status === HttpStatus.fromLiteral("NoContent") ? "served" : "forbidden";
			}),
		normalizedTrust: () =>
			Effect.sync(() => {
				story.tell("the host normalizes the configured proxy trust");
				return trustedProxyRanges(state.trust);
			}),
		pageCountsAsSameOrigin: (headers: Readonly<Record<string, string>>) =>
			Effect.sync(() => {
				story.tell(`a Fetch page request to localhost carries ${JSON.stringify(headers)}`);
				return sameOrigin(pageRequest(headers));
			}),
		transportHeaders: (message: Readonly<Record<string, string>>, http?: Readonly<Record<string, string>>) =>
			Effect.gen(function* () {
				story.tell(
					http === undefined
						? `an RPC message with headers ${JSON.stringify(message)} arrives outside any HTTP request`
						: `an RPC message with headers ${JSON.stringify(message)} arrives inside an HTTP request with headers ${JSON.stringify(http)}`,
				);
				const resolved = transportHeaders(Headers.fromInput(message));
				const headers = yield* http === undefined
					? resolved
					: Effect.provideService(resolved, HttpServerRequest.HttpServerRequest, httpRequestWith(http));
				return { ...headers };
			}),
	}),
});

function httpRequestWith(headers: Readonly<Record<string, string>>) {
	return HttpServerRequest.fromWeb(new Request("https://http.example/rpc", { headers }));
}

export function trustedProxy(trust: string | undefined) {
	return transport.trait(
		"configured",
		trust === undefined ? "the app configures no proxy trust" : `the app trusts the proxy ${JSON.stringify(trust)}`,
		(state) => {
			state.trust = trust;
		},
	);
}
