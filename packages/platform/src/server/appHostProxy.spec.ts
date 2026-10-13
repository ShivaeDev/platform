import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, ConfigProvider, Effect, Layer, ManagedRuntime, Redacted, Result } from "effect";
import { HttpServer } from "effect/http";
import * as NetAddress from "effect/net/NetAddress";
import { SqlClient } from "effect/sql";
import { expect, it } from "vitest";
import { appHost } from "#appHost.ts";
import { AuthUnavailable, Conflict, Unauthorized } from "#errors/taxonomy.ts";
import { Api, call, feature, handlers, post, sessions } from "#test/app-host/fixture.ts";
import { forwardingProxy } from "#test/app-host/forwardingProxy.ts";

const database = Effect.runSync(Config.String("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL").pipe(Config.option));
it.runIf(database._tag === "Some").each([
	{ accepted: true, config: undefined, env: { "HOST": "0.0.0.0", "TRUSTED_PROXY": "127.0.0.2" }, host: "0.0.0.0", name: "environment" },
	{
		accepted: true,
		config: { host: "0.0.0.0", trustedProxy: "127.0.0.2" },
		env: { "HOST": "127.0.0.1", "TRUSTED_PROXY": "127.0.0.3" },
		host: "0.0.0.0",
		name: "config overrides environment",
	},
	{ accepted: false, config: undefined, env: {}, host: "127.0.0.1", name: "no trust" },
	{ accepted: false, config: { trustedProxy: "127.0.0.3" }, env: { "TRUSTED_PROXY": "127.0.0.2" }, host: "127.0.0.1", name: "wrong configured peer" },
	{ accepted: true, config: undefined, env: { "TRUSTED_PROXY": "127.0.0.2/31" }, host: "127.0.0.1", name: "environment range" },
	{ accepted: true, config: { trustedProxy: "192.0.2.1, 127.0.0.2/31, 2001:db8::/32" }, env: {}, host: "127.0.0.1", name: "configured list" },
	{ accepted: false, config: { trustedProxy: "127.0.0.0/31" }, env: {}, host: "127.0.0.1", name: "peer just outside range" },
])("forwards real HTTP RPC with $name", async ({ config, env, accepted, host }) => {
	if (database._tag === "None") {
		throw new Error("PostgreSQL URL is required");
	}
	const table = `proxy_${crypto.randomUUID().replaceAll("-", "")}`;
	const ledger = `${table}_migrations`;
	const lookups: string[] = [];
	const lifecycle: string[] = [];
	const { loader, services } = feature(table, lifecycle);
	const runtime = ManagedRuntime.make(
		appHost({
			...(config === undefined ? {} : { config }),
			group: Api,
			handlers,
			migrations: { loader, table: ledger },
			services,
			sessions: sessions(lookups),
		}).pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { ...env, "DATABASE_URL": database.value, "PORT": "0" } })))),
	);
	let proxy: Awaited<ReturnType<typeof forwardingProxy>> | undefined;
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		if (!NetAddress.isInetAddress(server.address)) {
			throw new Error("Expected TCP address");
		}
		expect(NetAddress.formatIp(server.address.address)).toBe(host);
		proxy = await forwardingProxy(`http://127.0.0.1:${server.address.port}`);
		if (!accepted) {
			const refused = await call(proxy.url, "alice", false, { origin: "https://app.example" });
			expect(Result.isFailure(refused) && refused.failure._tag).toBe("RpcClientError");
			expect(await post(proxy.url, { origin: "https://app.example" })).toBe(403);
			expect(lookups).toEqual([]);
			return;
		}
		const result = await call(proxy.url, "alice", false, { origin: "https://app.example" });
		expect(Result.isSuccess(result) && result.success).toBe("Hello, alice");
		for (const [token, reject, expected] of [
			["", false, Unauthorized],
			["alice", true, Conflict],
			["outage", false, AuthUnavailable],
		] as const) {
			const refused = await call(proxy.url, token, reject, { origin: "https://app.example" });
			expect(Result.isFailure(refused) && refused.failure).toBeInstanceOf(expected);
		}
		const before = lookups.length;
		expect(await post(proxy.url, { origin: "https://elsewhere.example" })).toBe(403);
		expect(await post(proxy.url, { "content-type": "application/json" })).toBe(403);
		expect(lookups).toHaveLength(before);
	} finally {
		await proxy?.close();
		await runtime.dispose();
		const cleanup = ManagedRuntime.make(PgClient.layer({ url: Redacted.make(database.value) }));
		try {
			await cleanup.runPromise(SqlClient.SqlClient.use((sql) => sql`drop table if exists ${sql(table)}, ${sql(ledger)}`));
		} finally {
			await cleanup.dispose();
		}
	}
});
