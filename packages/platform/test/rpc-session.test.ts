import { Effect, Option } from "effect";
import { expect, test } from "vitest";
import { AuthUnavailable, Forbidden, Unauthorized } from "../src/errors.ts";
import { type OriginPolicy, trustedOrigins } from "../src/rpc-server.ts";
import { makeApp } from "./rpc/api.ts";
import { annotationsOf, createProvider, origin, signup } from "./rpc/support.ts";

const browser = trustedOrigins({ allow: [origin, "capacitor://localhost"], missing: "reject" });

test("Better Auth sessions give each concurrent native RPC request its own identity", async () => {
	const provider = await createProvider();
	const { app, call, logs, spans } = makeApp(provider, browser);
	try {
		const alice = await signup(provider, "alice");
		const bob = await signup(provider, "bob");
		const users = Array.from({ length: 12 }, (_, index) => ({ ...(index % 2 === 0 ? alice : bob), requestId: `request-${index}` }));
		const results = await Promise.all(
			users.map((user) => call({ cookie: user.cookie, origin, "x-request-id": user.requestId }, (client) => client.Whoami())),
		);
		results.forEach((result, index) => {
			expect(result).toMatchObject({ _tag: "Success", success: `${users[index]?.userId} ${users[index]?.requestId}` });
		});
		const handled = annotationsOf(logs, "handled");
		expect(handled).toHaveLength(users.length);
		for (const user of users) {
			expect(handled).toContainEqual(expect.objectContaining({ requestId: user.requestId, userId: user.userId, "rpc.method": "Whoami" }));
			const span = spans.find((candidate) => candidate.attributes.get("request.id") === user.requestId);
			expect(span?.name).toBe("RpcServer.Whoami");
			expect(span?.attributes.get("user.id")).toBe(user.userId);
		}

		const denied = await call({ cookie: alice.cookie, origin }, (client) => client.ReadOwn({ userId: bob.userId }));
		expect(denied).toMatchObject({ _tag: "Failure", failure: { _tag: "Forbidden", message: "Not your account" } });
		expect(denied._tag === "Failure" && denied.failure).toBeInstanceOf(Forbidden);
		expect(await call({ cookie: bob.cookie, origin }, (client) => client.Greeting())).toMatchObject({
			_tag: "Success",
			success: `hello ${bob.userId}`,
		});
		expect(await call({ origin }, (client) => client.Greeting())).toMatchObject({ _tag: "Success", success: "hello anonymous" });
	} finally {
		await app.dispose();
		provider.database.close();
	}
}, 20_000);

test("missing sessions are unauthorized while provider failures are reported as unavailable", async () => {
	const provider = await createProvider();
	const { app, call, logs } = makeApp(provider, browser);
	try {
		const alice = await signup(provider, "alice");
		const missing = await call({ origin }, (client) => client.Whoami());
		expect(missing).toMatchObject({ _tag: "Failure", failure: { _tag: "Unauthorized" } });
		expect(await call({ cookie: `${alice.cookie}tampered`, origin }, (client) => client.Whoami())).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "Unauthorized" },
		});
		expect(missing._tag === "Failure" && missing.failure).toBeInstanceOf(Unauthorized);

		provider.database.close();
		const outage = await call({ cookie: alice.cookie, origin }, (client) => client.Whoami());
		expect(outage).toMatchObject({ _tag: "Failure", failure: { _tag: "AuthUnavailable", message: "Authentication is temporarily unavailable" } });
		expect(outage._tag === "Failure" && outage.failure).toBeInstanceOf(AuthUnavailable);
		expect(await call({ cookie: alice.cookie, origin }, (client) => client.Greeting())).toMatchObject({
			_tag: "Failure",
			failure: { _tag: "AuthUnavailable" },
		});
		const failures = logs.filter(
			(log) => log.level === "Error" && Array.isArray(log.message) && log.message.includes("Authentication provider failed"),
		);
		expect(failures.length).toBeGreaterThanOrEqual(2);
		expect(failures[0]?.annotations).toMatchObject({ "rpc.method": "Whoami" });
		expect(annotationsOf(logs, "RPC failure")).toContainEqual(expect.objectContaining({ "rpc.failure": "AuthUnavailable" }));
	} finally {
		await app.dispose();
	}
}, 20_000);

test("origin policy is an explicit decision evaluated before the provider is consulted", async () => {
	const provider = await createProvider();
	const onlyPublicWithoutOrigin: OriginPolicy = (request) =>
		Option.match(request.origin, { onNone: () => request.rpc === "Greeting", onSome: (value) => value === origin });
	const strict = makeApp(provider, browser);
	const permissive = makeApp(provider, trustedOrigins({ allow: [origin], missing: "allow" }));
	const custom = makeApp(provider, onlyPublicWithoutOrigin);
	try {
		const alice = await signup(provider, "alice");
		const whoami = (app: typeof strict, headers: Readonly<Record<string, string>>) =>
			app.call({ cookie: alice.cookie, ...headers }, (client) => Effect.map(client.Whoami(), (value) => value.split(" ")[0]));
		const success = { _tag: "Success", success: alice.userId };
		const forbidden = { _tag: "Failure", failure: { _tag: "Forbidden", message: "Origin not allowed" } };

		expect(await whoami(strict, { origin })).toMatchObject(success);
		expect(await whoami(strict, { origin: "capacitor://localhost" })).toMatchObject(success);
		const lookups = provider.lookups();
		expect(await whoami(strict, { origin: "https://attacker.example" })).toMatchObject(forbidden);
		expect(await whoami(strict, { origin: "null" })).toMatchObject(forbidden);
		expect(await whoami(strict, {})).toMatchObject(forbidden);
		expect(await strict.call({ cookie: alice.cookie }, (client) => client.Greeting())).toMatchObject(forbidden);
		expect(provider.lookups()).toBe(lookups);

		expect(await whoami(permissive, {})).toMatchObject(success);
		expect(await whoami(permissive, { origin: "capacitor://localhost" })).toMatchObject(forbidden);

		expect(await whoami(custom, {})).toMatchObject(forbidden);
		expect(await custom.call({ cookie: alice.cookie }, (client) => client.Greeting())).toMatchObject({
			_tag: "Success",
			success: `hello ${alice.userId}`,
		});
	} finally {
		await Promise.all([strict.app.dispose(), permissive.app.dispose(), custom.app.dispose()]);
		provider.database.close();
	}
}, 20_000);
