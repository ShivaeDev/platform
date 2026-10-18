import { Effect } from "effect";
import { Headers, HttpServerRequest } from "effect/http";
import { expect, it } from "vitest";
import { trustedOrigins } from "#server/rpc-server/origin.ts";
import { makeApp } from "#test/rpc/api.ts";
import { createProvider, ORIGIN, signup } from "#test/rpc/harness.ts";
import { transportHeaders } from "./transportHeaders.ts";

const browser = trustedOrigins({ allow: [ORIGIN], missing: "reject" });
async function post(
	app: {
		readonly handler: (request: Request) => Promise<Response>;
	},
	transport: Readonly<Record<string, string>>,
	message: ReadonlyArray<readonly [string, string]>,
) {
	const response = await app.handler(
		new Request(`${ORIGIN}/rpc`, {
			body: JSON.stringify([{ _tag: "Request", headers: message, id: "1", payload: null, tag: "Whoami" }]),
			headers: { "content-type": "text/plain", ...transport },
			method: "POST",
		}),
	);
	return JSON.stringify(await response.json());
}
it("client-supplied message headers cannot satisfy the origin policy or carry credentials", async () => {
	const provider = await createProvider();
	const { app } = makeApp(provider, browser);
	try {
		const alice = await signup(provider, "alice");
		const forbidden = /"_tag":"Forbidden".*"Origin not allowed"/u;
		expect(await post(app, { cookie: alice.cookie, origin: ORIGIN }, [])).toContain(alice.userId);
		expect(await post(app, { cookie: alice.cookie, origin: "https://attacker.example" }, [["origin", ORIGIN]])).toMatch(forbidden);
		expect(await post(app, { cookie: alice.cookie }, [["origin", ORIGIN]])).toMatch(forbidden);
		expect(await post(app, { cookie: alice.cookie, origin: "https://attacker.example" }, [["Origin", ORIGIN]])).toMatch(forbidden);
		const lookups = provider.lookups();
		const forged = await post(app, { origin: ORIGIN }, [["cookie", alice.cookie]]);
		expect(forged).toContain('"_tag":"Unauthorized"');
		expect(forged).not.toContain(alice.userId);
		expect(provider.lookups()).toBe(lookups + 1);
		expect(await post(app, { origin: ORIGIN }, [["authorization", `Bearer ${alice.cookie}`]])).toContain('"_tag":"Unauthorized"');
	} finally {
		await app.dispose();
		provider.database.close();
	}
});

it("returns RPC headers when there is no HTTP request service", async () => {
	const rpcHeaders = Headers.fromInput({ authorization: "Bearer rpc", origin: "https://rpc.example" });
	expect(await Effect.runPromise(transportHeaders(rpcHeaders))).toBe(rpcHeaders);
});

it("uses only the HTTP request headers when a request service is available", async () => {
	const rpcHeaders = Headers.fromInput({ authorization: "Bearer rpc", origin: "https://rpc.example", "x-rpc-only": "ignored" });
	const request = HttpServerRequest.fromWeb(new Request("https://http.example/rpc", { headers: { origin: "https://http.example" } }));
	const headers = await Effect.runPromise(transportHeaders(rpcHeaders).pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, request)));
	expect(headers).toBe(request.headers);
	expect(headers.origin).toBe("https://http.example");
	expect(headers.authorization).toBeUndefined();
	expect(headers["x-rpc-only"]).toBeUndefined();
});
