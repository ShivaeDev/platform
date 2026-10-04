import { expect, it } from "vitest";
import { trustedOrigins } from "#rpc-server.ts";
import { makeApp } from "#test/rpc/api.ts";
import { createProvider, origin, signup } from "#test/rpc/support.ts";

const browser = trustedOrigins({ allow: [origin], missing: "reject" });

const post = async (
	app: { readonly handler: (request: Request) => Promise<Response> },
	transport: Readonly<Record<string, string>>,
	message: ReadonlyArray<readonly [string, string]>,
) => {
	const response = await app.handler(
		new Request(`${origin}/rpc`, {
			body: JSON.stringify([{ _tag: "Request", headers: message, id: "1", payload: null, tag: "Whoami" }]),
			headers: { "content-type": "text/plain", ...transport },
			method: "POST",
		}),
	);
	return JSON.stringify(await response.json());
};

it("client-supplied message headers cannot satisfy the origin policy or carry credentials", async () => {
	const provider = await createProvider();
	const { app } = makeApp(provider, browser);
	try {
		const alice = await signup(provider, "alice");
		const forbidden = /"_tag":"Forbidden".*"Origin not allowed"/u;

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
