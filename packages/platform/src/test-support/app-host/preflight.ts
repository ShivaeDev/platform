import * as PgClient from "@effect/sql-pg/PgClient";
import { Config, Context, Effect, Layer, Schema } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { appDatabase, appHost } from "#server/appHost.ts";
import type { MigrationOptions } from "#server/MigrationOptions.ts";
import { Ping } from "./ping.ts";
import { host } from "./story.ts";

export class AppId extends Context.Service<AppId, string>()("@test/PreflightAppId") {}
export class PreflightFailure extends Schema.TaggedError<PreflightFailure>()("PreflightFailure", {}) {}

export function preflight(mode: "http" | "migrate" | "check" | "wait", deferred = false) {
	return host.trait(
		"configured",
		`${mode} host validates its app ID before startup${deferred ? " with deferred construction" : ""}`,
		function* (state) {
			const validation = Layer.effect(
				AppId,
				Effect.gen(function* () {
					state.lifecycle.push("preflight");
					const id = yield* Config.String("APP_ID");
					const validated = yield* Schema.decodeUnknownEffect(Schema.NonEmptyString)(id).pipe(Effect.mapError(() => new PreflightFailure()));
					return yield* Effect.acquireRelease(Effect.succeed(validated), () => Effect.sync(() => state.lifecycle.push("released")));
				}),
			);
			const options = {
				config: state.config,
				group: Ping,
				handlers: Ping.toLayer({ ping: () => AppId }),
				policy: "loopback" as const,
				services: Layer.effectDiscard(AppId.pipe(Effect.tap(() => Effect.sync(() => state.lifecycle.push("started"))))),
			};
			if (mode === "http") {
				state.build = () => appHost({ ...options, preflight: validation });
				return;
			}
			const databaseUrl = yield* Config.Redacted("PLATFORM_EFFECT_SQL_TEST_DATABASE_URL");
			const table = `preflight_${crypto.randomUUID().replaceAll("-", "")}`;
			const loader = Migrator.fromRecord({ "001_prepare": Effect.sync(() => state.lifecycle.push("migrated")) });
			const migrations: MigrationOptions<AppId> = {
				loader: Effect.gen(function* () {
					state.lifecycle.push("loading");
					yield* AppId;
					return yield* loader;
				}),
				mode,
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
			if (mode === "check" || mode === "wait") {
				yield* Layer.build(appDatabase({ config, migrations: { loader, table } })).pipe(Effect.scoped);
				state.lifecycle.length = 0;
			}
			const application = Effect.gen(function* () {
				yield* AppId;
				state.lifecycle.push("constructing");
				return options;
			});
			state.build = () =>
				deferred
					? appHost({
							application,
							config,
							migrations,
							preflight: validation,
						})
					: appHost({ ...options, config: { ...state.config, ...config }, migrations, preflight: validation });
		},
	);
}
