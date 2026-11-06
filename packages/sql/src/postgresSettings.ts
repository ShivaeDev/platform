import { Effect, Schema } from "effect";
import { SqlClient, SqlSchema } from "effect/sql";

export type PostgresSettings = Readonly<Record<string, string>>;

const Setting = Schema.Struct({
	context: Schema.String,
	pendingRestart: Schema.Boolean,
	setting: Schema.String,
	unit: Schema.NullOr(Schema.String),
	vartype: Schema.String,
}).pipe(Schema.encodeKeys({ pendingRestart: "pending_restart" }));

export const applyPostgresSettings = Effect.fn("Sql.applyPostgresSettings")(function* (settings: PostgresSettings) {
	const sql = (yield* SqlClient.SqlClient).withoutTransforms();
	const read = SqlSchema.findAll({
		execute: (name) => sql`select setting, unit, vartype, context, pending_restart from pg_settings where name = ${name}`,
		Request: Schema.String,
		Result: Setting,
	});
	const changed: Array<{ name: string; live: string; wanted: string; restart: boolean }> = [];
	for (const [name, wanted] of Object.entries(settings)) {
		let live = "unavailable";
		yield* Effect.gen(function* () {
			const [current] = yield* read(name);
			if (current === undefined) {
				return yield* Effect.logWarning("PostgreSQL setting is unknown", { live, setting: name, wanted });
			}
			live = `${current.setting}${current.unit === null ? "" : ` ${current.unit}`}`;
			if (yield* settingMatches(current, wanted)) {
				return;
			}
			yield* sql.unsafe(`ALTER SYSTEM SET "${name.replaceAll('"', '""')}" = '${wanted.replaceAll("'", "''")}'`).unprepared;
			changed.push({ live, name, restart: current.context === "postmaster", wanted });
		}).pipe(Effect.catch((error) => Effect.logWarning("Could not apply PostgreSQL setting", { error, live, setting: name, wanted })));
	}
	if (changed.length === 0) {
		return;
	}
	yield* sql`select pg_reload_conf()`.pipe(
		Effect.andThen(
			Effect.forEach(changed, (change) =>
				Effect.gen(function* () {
					const [current] = yield* read(change.name);
					// Reload signals are asynchronous; postmaster settings written above already require a restart.
					if (current?.pendingRestart || change.restart) {
						yield* Effect.logWarning("PostgreSQL setting pending restart", { setting: change.name, wanted: change.wanted });
					}
				}),
			),
		),
		Effect.catch((error) =>
			Effect.forEach(changed, ({ name, live, wanted }) =>
				Effect.logWarning("Could not reload PostgreSQL setting", { error, live, setting: name, wanted }),
			),
		),
	);
});

const settingMatches = Effect.fnUntraced(function* (current: typeof Setting.Type, wanted: string) {
	if (current.setting === wanted) {
		return true;
	}
	const sql = yield* SqlClient.SqlClient;
	let comparison = sql`${current.setting} = ${wanted}`;
	if (current.vartype === "bool") {
		comparison = sql`${current.setting}::boolean = ${wanted}::boolean`;
	} else if (["integer", "real"].includes(current.vartype)) {
		if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/iu.test(wanted.trim())) {
			comparison = sql`${current.setting}::numeric = ${wanted}::numeric`;
		} else if (["B", "kB", "8kB", "MB"].includes(current.unit ?? "")) {
			const unit = current.unit === "8kB" ? "8kB" : `1${current.unit}`;
			comparison = sql`${current.setting}::numeric * pg_size_bytes(${unit}) = pg_size_bytes(${wanted})`;
		} else if (["us", "ms", "s", "min", "h", "d"].includes(current.unit ?? "")) {
			comparison = sql`${current.setting}::numeric * extract(epoch from ${`1 ${current.unit}`}::interval) = extract(epoch from ${wanted}::interval)`;
		}
	}
	const [row] = yield* SqlSchema.findAll({
		execute: () => sql`select ${comparison} as matches`,
		Request: Schema.Void,
		Result: Schema.Struct({ matches: Schema.Boolean }),
	})();
	return row?.matches === true;
});
