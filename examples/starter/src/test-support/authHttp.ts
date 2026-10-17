import { Effect, Layer } from "effect";
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http";
import { RpcClient, RpcSerialization } from "effect/rpc";
import { expect } from "vitest";
import { Notes } from "#notes.ts";

export const authPost = Effect.fn("AppTest.authPost")(function* (baseUrl: string, path: string, body: object, cookie = "", origin = baseUrl) {
	const response = yield* Effect.promise(() =>
		fetch(`${baseUrl}/api/auth/${path}`, {
			body: JSON.stringify(body),
			headers: { "content-type": "application/json", cookie, origin },
			method: "POST",
		}),
	);
	expect(response.status).toBe(200);
	yield* Effect.promise(() => response.text());
	const cookies = response.headers.getSetCookie();
	if (origin.startsWith("https://")) {
		expect(cookies.some((value) => value.startsWith("__Secure-better-auth.session_token=") && /; Secure(?:;|$)/iv.test(value))).toBe(true);
	}
	return cookies.map((value) => value.split(";")[0]).join("; ");
});

export function notesHttp(baseUrl: string, cookie = "", origin = baseUrl) {
	const protocol = RpcClient.layerProtocolHttp({
		transformClient: (client) => HttpClient.mapRequest(client, HttpClientRequest.setHeaders({ cookie, origin })),
		url: `${baseUrl}/rpc`,
	}).pipe(Layer.provide([FetchHttpClient.layer, RpcSerialization.layerNdjson]));
	return RpcClient.make(Notes).pipe(Effect.provide(protocol));
}

export function credentials(name: string) {
	return { email: `${name}@app.test`, name, password: "correct-horse-battery-staple" };
}
