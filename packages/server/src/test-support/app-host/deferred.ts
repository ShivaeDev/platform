import { Effect, Layer } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { appDatabase, appHost } from "#appDatabase.ts";
import { Ping, pingHandlers } from "#test/app-host/ping.ts";
import { databaseOf, type HostState } from "#test/app-host/state.ts";
import { postgresHost } from "#test/app-host/story.ts";

export function deferred(mode: "migrate" | "check", fails = false) {
	return postgresHost.trait("configured", `deferred construction follows ${fails ? "failed " : ""}${mode}`, function* (state) {
		const databaseUrl = databaseOf(state).url;
		const table = "deferred_migrations";
		const migrations = {
			loader: migrationLoader(state, fails),
			table,
		};
		const config = { databaseUrl };
		if (mode === "check" && !fails) {
			yield* Layer.build(appDatabase({ config, migrations, postgresSettings: {} })).pipe(Effect.scoped);
		}
		function build() {
			return appHost({ application: application(state, table), config, migrations: { ...migrations, mode }, postgresSettings: {} });
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
