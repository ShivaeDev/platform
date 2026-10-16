import { Config, Effect, ManagedRuntime, Redacted } from "effect";
import { HttpServer } from "effect/http";
import { Migrator } from "effect/sql";
import { expect, it } from "vitest";
import { appDatabase, appHost } from "#appHost.ts";
import { databaseProxy } from "#test/app-host/databaseProxy.ts";
import { sessions, staticAssets } from "#test/app-host/fixture.ts";
import { Ping, pingHandlers } from "#test/app-host/ping.ts";

const database = Effect.runSync(Config.String("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL").pipe(Config.option));

it.runIf(database._tag === "Some").each(["migrations", "services"] as const)(
	"health probes PostgreSQL from %s without authentication and returns no database details on failure",
	async (source) => {
		if (database._tag === "None") {
			throw new Error("PostgreSQL URL is required");
		}
		const proxy = await databaseProxy(database.value);
		const assets = await staticAssets();
		const lookups: string[] = [];
		const options = {
			assets: { root: assets.path, spa: true },
			config: { databaseUrl: Redacted.make(proxy.url), port: 0 },
			group: Ping,
			handlers: pingHandlers,
			sessions: sessions(lookups),
		};
		const migrations = { loader: Migrator.fromRecord({}) };
		const host =
			source === "migrations"
				? appHost({ ...options, migrations })
				: appHost({ ...options, services: appDatabase({ config: options.config, migrations }) });
		const runtime = ManagedRuntime.make(host);
		try {
			const server = await runtime.runPromise(HttpServer.HttpServer);
			const url = `${HttpServer.formatAddress(server.address)}/health`;
			for (const [reachable, expected] of [
				[true, 200],
				[false, 503],
				[true, 200],
			] as const) {
				proxy.setReachable(reachable);
				const response = await fetch(url, { headers: { origin: "https://health-monitor.example" }, signal: AbortSignal.timeout(5000) });
				expect(response.status).toBe(expected);
				expect(await response.text()).toBe("");
				expect(response.headers.get("cache-control")).toBe("no-store");
			}
			proxy.setResponsive(false);
			const stalled = await fetch(url, { signal: AbortSignal.timeout(5000) });
			expect(stalled.status).toBe(503);
			expect(await stalled.text()).toBe("");
			expect(lookups).toEqual([]);
		} finally {
			proxy.setResponsive(true);
			await runtime.dispose();
			await proxy.close();
			await assets.close();
		}
	},
);
