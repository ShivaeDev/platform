import { Effect, Option } from "effect";
import { Headers, HttpServerRequest, HttpServerResponse } from "effect/http";
import { RpcSerialization } from "effect/rpc";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { localRpcGuard, loopbackOnly, sameOrigin } from "#rpc-server/local.ts";
import { transportHeaders } from "#rpc-server/transport.ts";

export const forwarded = {
	"content-type": "application/ndjson",
	host: "internal.test",
	origin: "https://app.example",
	"x-forwarded-host": "app.example",
	"x-forwarded-proto": "https",
};
export const transport = storyKit({
	create: (): { trust: string | undefined } => ({ trust: undefined }),
	name: "RPC transport",
	stages: ["configured"],
	verbs: (state, story) => ({
		guarded: (address: string | undefined, trust = state.trust, headers: Readonly<Record<string, string>> = forwarded) =>
			Effect.gen(function* () {
				story.tell(`a request from ${address ?? "an unknown peer"} reaches the RPC guard`);
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
				return { calls, status: response.status };
			}),
		page: () =>
			Effect.gen(function* () {
				story.tell("a Fetch page without a transport address reaches the loopback handler");
				const request = HttpServerRequest.fromWeb(new Request("http://localhost/", { headers: { host: "localhost" } }));
				const response = yield* loopbackOnly(() => Effect.succeed(HttpServerResponse.empty()))(request);
				return { sameOrigin: sameOrigin(request), status: response.status };
			}),
		resolveHeaders: (rpc: Readonly<Record<string, string>>, http?: Readonly<Record<string, string>>) =>
			Effect.gen(function* () {
				story.tell("the boundary resolves transport headers");
				const message = Headers.fromInput(rpc);
				const request = http === undefined ? undefined : HttpServerRequest.fromWeb(new Request("https://http.example/rpc", { headers: http }));
				const resolved = yield* request === undefined
					? transportHeaders(message)
					: transportHeaders(message).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request));
				return { message, request, resolved };
			}),
	}),
});
export function trustedProxy(trust: string) {
	return transport.trait("configured", `the transport trusts proxy ${trust}`, (state) => {
		state.trust = trust;
	});
}
