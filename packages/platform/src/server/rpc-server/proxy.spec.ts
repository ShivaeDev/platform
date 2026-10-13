import { Effect, Option } from "effect";
import { HttpServerRequest, HttpServerResponse } from "effect/http";
import { RpcSerialization } from "effect/rpc";
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
	["100.64.0.0", "100.64.0.0/10", true],
	["::ffff:100.127.255.255", "100.64.0.0/10", true],
	["100.63.255.255", "100.64.0.0/10", false],
	["100.128.0.0", "100.64.0.0/10", false],
	["2001:db8:1::ffff", "2001:db8:1::/48", true],
	["2001:db8:2::", "2001:db8:1::/48", false],
	["2001:0DB8:0001:0:0:0:0:2", "2001:db8:1::2", true],
	["::ffff:a00:2", "10.0.0.0/24", true],
	["10.0.0.2", "::ffff:10.0.0.0/120", true],
	["10.0.0.2", " 192.0.2.1, 10.0.0.0/24, 2001:db8::/32 ", true],
	["2001:db8::1", "192.0.2.1, 10.0.0.0/24, 2001:db8::/32", true],
	["192.0.2.1", "192.0.2.1, 10.0.0.0/24, 2001:db8::/32", true],
	["192.0.2.2", "192.0.2.1, 10.0.0.0/24, 2001:db8::/32", false],
	[undefined, "100.64.0.0/10", false],
])("matches transport peer %s against %s", async (address, trust, accepted) => {
	expect(await guarded(address, trust)).toEqual({ calls: accepted ? 1 : 0, status: accepted ? 204 : 403 });
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
	expect(await guarded("10.0.0.2", "10.0.0.0/24", { ...forwarded, ...headers })).toEqual({ calls: 0, status: 403 });
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
