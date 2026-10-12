import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/unstable/http";
import { RpcSerialization } from "effect/unstable/rpc";
import { expect, it } from "vitest";
import { localRpcGuard } from "./local.ts";

const forwarded = {
	"content-type": "application/ndjson",
	host: "internal.test",
	origin: "https://app.example",
	"x-forwarded-host": "app.example",
	"x-forwarded-proto": "https",
};
async function guarded(address: string | undefined, trustedProxy?: string, headers: Readonly<Record<string, string>> = forwarded) {
	let calls = 0;
	const request = HttpServerRequest.fromWeb(new Request("http://internal.test/rpc", { headers })).modify({
		remoteAddress: Option.fromNullishOr(address),
	});
	const response = await Effect.runPromise(
		localRpcGuard(
			Effect.sync(() => {
				calls += 1;
				return HttpServerResponse.empty();
			}),
			trustedProxy,
		).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request), Effect.provide(RpcSerialization.layerNdjson)),
	);
	return { calls, status: response.status };
}

it("trusts forwarded authority only from the configured transport peer", async () => {
	expect(await guarded("10.0.0.2", "10.0.0.2")).toEqual({ calls: 1, status: 204 });
	expect(await guarded("::ffff:10.0.0.2", "10.0.0.2")).toEqual({ calls: 1, status: 204 });
	expect(await guarded("10.0.0.2")).toEqual({ calls: 0, status: 403 });
	expect(await guarded("10.0.0.3", "10.0.0.2")).toEqual({ calls: 0, status: 403 });
	expect(await guarded(undefined, "10.0.0.2")).toEqual({ calls: 0, status: 403 });
});
it.each([
	{ origin: "https://elsewhere.example" },
	{ origin: "http://app.example" },
	{ "x-forwarded-host": "app.example, elsewhere.example" },
	{ "x-forwarded-host": "app.example/path" },
	{ "x-forwarded-host": "user@app.example" },
	{ "x-forwarded-host": "" },
	{ "x-forwarded-proto": "https, http" },
	{ "x-forwarded-proto": "ftp" },
	{ "x-forwarded-proto": "" },
	{ "content-type": "application/json" },
])("refuses invalid forwarded requests before the handler: %j", async (headers) => {
	expect(await guarded("10.0.0.2", "10.0.0.2", { ...forwarded, ...headers })).toEqual({ calls: 0, status: 403 });
});
it("accepts HTTP forwarding, explicit ports and absent Origin", async () => {
	expect(
		await guarded("10.0.0.2", "10.0.0.2", {
			...forwarded,
			origin: "http://app.example:8080",
			"x-forwarded-host": "app.example:8080",
			"x-forwarded-proto": "http",
		}),
	).toEqual({ calls: 1, status: 204 });
	const { origin: _, ...headers } = forwarded;
	expect(await guarded("10.0.0.2", "10.0.0.2", headers)).toEqual({ calls: 1, status: 204 });
});
