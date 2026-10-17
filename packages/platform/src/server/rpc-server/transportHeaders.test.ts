import { expect, it } from "vitest";
import { trustedOrigins } from "#rpc-server/origin.ts";
import { makeApp } from "#test/rpc/api.ts";
import { createProvider, ORIGIN, signup } from "#test/rpc/harness.ts";

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
