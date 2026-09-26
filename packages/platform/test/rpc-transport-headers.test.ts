import { expect, test } from "vitest";
import { trustedOrigins } from "../src/rpc-server.ts";
import { makeApp } from "./rpc/api.ts";
import { createProvider, origin, signup } from "./rpc/support.ts";

const browser = trustedOrigins({ allow: [origin], missing: "reject" });

const post = async (
	app: { readonly handler: (request: Request) => Promise<Response> },
	transport: Readonly<Record<string, string>>,
	message: ReadonlyArray<readonly [string, string]>,
) => {
	const response = await app.handler(
		new Request(`${origin}/rpc`, {
			method: "POST",
			headers: { "content-type": "text/plain", ...transport },
			body: JSON.stringify([{ _tag: "Request", id: "1", tag: "Whoami", payload: null, headers: message }]),
		}),
	);
	return JSON.stringify(await response.json());
};

test("client-supplied message headers cannot satisfy the origin policy or carry credentials", async () => {
	const provider = await createProvider();
	const { app } = makeApp(provider, browser);
	try {
		const alice = await signup(provider, "alice");
		const forbidden = /"_tag":"Forbidden".*"Origin not allowed"/;

		expect(await post(app, { cookie: alice.cookie, origin }, [])).toContain(alice.userId);
		expect(await post(app, { cookie: alice.cookie, origin: "https://attacker.example" }, [["origin", origin]])).toMatch(forbidden);
		expect(await post(app, { cookie: alice.cookie }, [["origin", origin]])).toMatch(forbidden);
		expect(await post(app, { cookie: alice.cookie, origin: "https://attacker.example" }, [["Origin", origin]])).toMatch(forbidden);

		const lookups = provider.lookups();
		const forged = await post(app, { origin }, [["cookie", alice.cookie]]);
		expect(forged).toContain('"_tag":"Unauthorized"');
		expect(forged).not.toContain(alice.userId);
		expect(provider.lookups()).toBe(lookups + 1);
		expect(await post(app, { origin }, [["authorization", `Bearer ${alice.cookie}`]])).toContain('"_tag":"Unauthorized"');
	} finally {
		await app.dispose();
		provider.database.close();
	}
}, 20_000);
