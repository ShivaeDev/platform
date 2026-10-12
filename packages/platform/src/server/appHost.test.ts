import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, ConfigProvider, Effect, Layer, ManagedRuntime, Redacted, Result } from "effect";
import { HttpRouter, HttpServer, HttpServerResponse } from "effect/unstable/http";
import { Migrator, SqlClient } from "effect/unstable/sql";
import { expect, it } from "vitest";
import { appHost } from "#appHost.ts";
import { AuthUnavailable, Conflict, Unauthorized } from "#errors/taxonomy.ts";
import { Api, call, feature, handlers, post, sessions, staticAssets } from "#test/app-host/fixture.ts";

const database = Effect.runSync(Config.string("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL").pipe(Config.option));
const test = it.runIf(database._tag === "Some");
function destination() {
	if (database._tag === "None") {
		throw new Error("PostgreSQL URL is required");
	}
	return database.value;
}
test("the host migrates before services, serves assets and guarded typed RPC, and releases its scope", async () => {
	const assets = await staticAssets();
	const table = `host_${crypto.randomUUID().replaceAll("-", "")}`;
	const ledger = `${table}_migrations`;
	const lifecycle: string[] = [];
	const lookups: string[] = [];
	const { loader, services } = feature(table, lifecycle);
	const environment = ConfigProvider.layer(
		ConfigProvider.fromEnv({ env: { "DATABASE_URL": destination(), "PORT": "0", "TRUSTED_PROXY": "127.0.0.0/8,::1" } }),
	);
	const runtime = ManagedRuntime.make(
		appHost({
			assets: { root: assets.path, spa: true },
			group: Api,
			handlers,
			migrations: { loader, table: ledger },
			routes: HttpRouter.add("GET", "/health", HttpServerResponse.text("Ready")),
			services,
			sessions: sessions(lookups),
		}).pipe(Layer.provide(environment)),
	);
	let url = "";
	try {
		const server = await runtime.runPromise(HttpServer.HttpServer);
		expect(server.address._tag).toBe("TcpAddress");
		if (server.address._tag !== "TcpAddress") {
			throw new Error("Expected TCP");
		}
		url = `http://${server.address.hostname}:${server.address.port}`;
		expect(server.address.hostname).toBe("127.0.0.1");
		expect(lifecycle).toEqual(["started"]);
		expect(await (await fetch(url)).text()).toBe("<main>Hosted app</main>");
		expect(await (await fetch(`${url}/health`)).text()).toBe("Ready");
		expect(await (await fetch(`${url}/sign-in`, { headers: { accept: "text/html" } })).text()).toBe("<main>Hosted app</main>");
		const success = await Promise.all([call(url, "alice"), call(url, "bob")]);
		expect(success.map((result) => Result.isSuccess(result) && result.success)).toEqual(["Hello, alice", "Hello, bob"]);
		for (const [token, reject, expected] of [
			["", false, Unauthorized],
			["alice", true, Conflict],
			["outage", false, AuthUnavailable],
		] as const) {
			const result = await call(url, token, reject);
			expect(Result.isFailure(result) && result.failure).toBeInstanceOf(expected);
		}
		const before = lookups.length;
		for (const headers of [{ origin: "http://elsewhere.test" }, { "content-type": "application/json" }, { host: "elsewhere.test" }]) {
			expect(await post(url, headers)).toBe(403);
		}
		expect(lookups).toHaveLength(before);
	} finally {
		await runtime.dispose();
		const cleanup = ManagedRuntime.make(PgClient.layer({ url: Redacted.make(destination()) }));
		try {
			await cleanup.runPromise(SqlClient.SqlClient.use((sql) => sql`drop table if exists ${sql(table)}, ${sql(ledger)}`));
		} finally {
			await cleanup.dispose();
			await assets.close();
		}
	}
	expect(lifecycle).toEqual(["started", "closed"]);
	await expect(fetch(url)).rejects.toThrow();
});
test("a migration failure prevents application services from starting", async () => {
	const lifecycle: string[] = [];
	const ledger = `host_failed_${crypto.randomUUID().replaceAll("-", "")}`;
	const { services } = feature("does_not_exist", lifecycle);
	const loader = Migrator.fromRecord({ "001_fail": Effect.fail(new Error("Migration failed")) });
	const runtime = ManagedRuntime.make(
		appHost({
			config: { databaseUrl: Redacted.make(destination()), port: 0 },
			group: Api,
			handlers,
			migrations: { loader, table: ledger },
			services,
			sessions: sessions([]),
		}),
	);
	try {
		await expect(runtime.runPromise(HttpServer.HttpServer)).rejects.toThrow();
		expect(lifecycle).toEqual([]);
	} finally {
		await runtime.dispose();
	}
});
