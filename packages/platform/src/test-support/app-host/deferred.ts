import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Effect, Layer } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { appDatabase, appHost } from "#server/appHost.ts";
import { Ping, pingHandlers } from "./ping.ts";
import type { HostState } from "./state.ts";
import { host } from "./story.ts";

export function deferred(mode: "migrate" | "check", fails = false) {
	return host.trait("configured", `deferred construction follows ${fails ? "failed " : ""}${mode}`, function* (state) {
		const databaseUrl = yield* Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
		const table = `deferred_${crypto.randomUUID().replaceAll("-", "")}`;
		const migrations = {
			loader: migrationLoader(state, fails),
			table,
		};
		const config = { databaseUrl };
		state.cleanup.push(() =>
			Effect.runPromise(
				SqlClient.SqlClient.use((sql) => sql`drop table if exists ${sql(table)}`).pipe(
					Effect.provide(PgClient.layer({ url: databaseUrl })),
					Effect.asVoid,
				),
			),
		);
		if (mode === "check" && !fails) {
			yield* Layer.build(appDatabase({ config, migrations })).pipe(Effect.scoped);
		}
		function build() {
			return appHost({
				application: application(state, table),
				config,
				migrations: { ...migrations, mode },
			});
		}
		state.build = build;
	});
}

function migrationLoader(state: HostState, fails: boolean) {
	if (fails) {
		return Migrator.fromRecord({ "001_fail": Effect.fail(new Error("Migration failed")) });
	}
	return Migrator.fromRecord({
		"001_prepare": Effect.sync(() => {
			state.lifecycle.push("migrated");
		}),
	});
}
const application = Effect.fnUntraced(function* (state: HostState, table: string) {
	state.lifecycle.push("constructing");
	const sql = yield* SqlClient.SqlClient;
	const rows = yield* sql`select name from ${sql(table)}`;
	if (JSON.stringify(rows) !== JSON.stringify([{ name: "prepare" }])) {
		return yield* Effect.die(new Error("Migration did not precede construction"));
	}
	yield* Effect.acquireRelease(
		Effect.sync(() => {
			state.lifecycle.push("constructed");
		}),
		() =>
			Effect.sync(() => {
				state.lifecycle.push("released");
			}),
	);
	return { config: state.config, group: Ping, handlers: pingHandlers, policy: "loopback" as const };
});
