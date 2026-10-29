import { layerWebSocket } from "@effect/platform-node/NodeSocket";
import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { Api } from "./api.ts";
import { type Host, NATIVE_ORIGIN } from "./host.ts";

export interface Account {
	readonly cookie: string;
	readonly credential: string | null;
	readonly exposed: string | null;
	readonly httpOnly: boolean;
	readonly token?: string;
	readonly user: { readonly id: string; readonly name: string; readonly email: string };
}

export function authRequest(host: Host, path: string, headers: Record<string, string>, body?: unknown) {
	return Effect.promise(() =>
		fetch(`${host.baseUrl}/api/auth/${path}`, {
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
			credentials: "omit",
			headers: { ...(body === undefined ? {} : { "content-type": "application/json" }), ...headers },
			method: body === undefined ? "GET" : "POST",
		}),
	);
}
export function register(host: Host, name: string) {
	return authRequest(host, "sign-up/email", { origin: NATIVE_ORIGIN }, { email: `${name}@example.test`, name, password: "story-password-123" });
}
export const login = Effect.fn("NativeSessions.login")(function* (host: Host, name: string, browser = false, headers: Record<string, string> = {}) {
	const response = yield* authRequest(
		host,
		"sign-in/email",
		{ origin: browser ? host.baseUrl : NATIVE_ORIGIN, ...headers },
		{
			email: `${name}@example.test`,
			password: "story-password-123",
		},
	);
	if (!response.ok) {
		return yield* Effect.die(`Sign-in returned ${response.status}: ${yield* Effect.promise(() => response.text())}`);
	}
	const result: Pick<Account, "user" | "token"> = yield* Effect.promise(() => response.json());
	return {
		...result,
		cookie: response.headers
			.getSetCookie()
			.map((value) => value.split(";")[0])
			.join("; "),
		credential: response.headers.get("set-auth-token"),
		exposed: response.headers.get("access-control-expose-headers"),
		httpOnly: response.headers.getSetCookie().some((value) => value.startsWith("better-auth.session_token=") && /; HttpOnly/iu.test(value)),
	};
});

export function client(host: Host, headers: Record<string, string>, socket = false) {
	const protocol = socket
		? RpcClient.layerProtocolSocket().pipe(
				Layer.provide([layerWebSocket(`${host.baseUrl.replace(/^http/u, "ws")}/rpc`, { headers }), RpcSerialization.layerNdjson]),
			)
		: RpcClient.layerProtocolHttp({
				transformClient: (http) => HttpClient.mapRequest(http, HttpClientRequest.setHeaders(headers)),
				url: `${host.baseUrl}/rpc`,
			}).pipe(
				Layer.provide([
					FetchHttpClient.layer.pipe(Layer.provide(Layer.succeed(FetchHttpClient.RequestInit, { credentials: "omit" }))),
					RpcSerialization.layerNdjson,
				]),
			);
	return Effect.flatMap(Layer.build(protocol), (services) => RpcClient.make(Api, { flatten: true }).pipe(Effect.provideContext(services)));
}
