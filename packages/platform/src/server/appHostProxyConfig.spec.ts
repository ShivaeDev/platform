import { Cause, Config, ConfigProvider, Effect, Exit, Layer, ManagedRuntime, Redacted, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import { Rpc, RpcGroup } from "effect/rpc";
import { Migrator } from "effect/sql";
import { expect, it } from "vitest";
import { appHost } from "#appHost.ts";
import { sessions } from "#test/app-host/fixture.ts";

const Api = RpcGroup.make(Rpc.make("ping", { success: Schema.String }));
it.each([
	"10.0.0.0/33",
	"2001:db8::/129",
	"10.0.0.0/-1",
	"10.0.0.0/1.5",
	"10.0.0.0/",
	"10.0.0.0/24/1",
	"10.0.0.0/nope",
	"10.0.0.999/24",
	"2001:db8::gg/64",
	"10.0.0.1,",
	"10.0.0.1,,::1",
	"",
	" ",
	"*",
	"proxy.example",
])("rejects malformed trust at startup from config and environment: %s", async (value) => {
	for (const source of ["config", "environment"]) {
		const lifecycle: string[] = [];
		const runtime = ManagedRuntime.make(
			appHost({
				config: {
					databaseUrl: Redacted.make("postgresql://unused:unused@127.0.0.1:1/unused"),
					port: 0,
					...(source === "config" ? { trustedProxy: value } : {}),
				},
				group: Api,
				handlers: Api.toLayer({ ping: () => Effect.succeed("pong") }),
				migrations: { loader: Migrator.fromRecord({ "001_never": Effect.sync(() => lifecycle.push("migrated")) }) },
				routes: HttpRouter.use(() => Effect.sync(() => lifecycle.push("routed"))),
				services: Layer.effectDiscard(Effect.sync(() => lifecycle.push("started"))),
				sessions: sessions([]),
			}).pipe(
				Layer.provide(
					ConfigProvider.layer(
						ConfigProvider.fromEnv({ env: source === "environment" ? { "TRUSTED_PROXY": value } : {}, preserveEmptyStrings: true }),
					),
				),
			),
		);
		try {
			const exit = await runtime.runPromiseExit(HttpServer.HttpServer);
			expect(Exit.isFailure(exit) && Cause.squash(exit.cause)).toBeInstanceOf(Config.ConfigError);
			expect(lifecycle).toEqual([]);
		} finally {
			await runtime.dispose();
		}
	}
});
