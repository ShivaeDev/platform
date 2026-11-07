import { Config, Context, Effect, Layer, Schema } from "effect";
import { Migrator } from "effect/sql";
import { appDatabase, appHost } from "#appDatabase.ts";
import type { MigrationOptions } from "#MigrationOptions.ts";
import { Ping } from "#test/app-host/ping.ts";
import { databaseOf } from "#test/app-host/state.ts";
import { host } from "#test/app-host/story.ts";

export class AppId extends Context.Service<AppId, string>()("@shivaedev/server/test/PreflightAppId") {}
class PreflightFailure extends Schema.TaggedError<PreflightFailure>()("PreflightFailure", { message: Schema.optional(Schema.String) }) {}

function preflightDiagnostic(diagnostics: "failure" | "success" | undefined) {
	if (diagnostics === "failure") {
		return Effect.fail(new PreflightFailure({ message: "Cannot connect to postgres://app:hidden-startup-password@localhost/db" })).pipe(
			Effect.tapCause((cause) =>
				Effect.logError("Preflight failed token=hidden-log-token", cause).pipe(
					Effect.annotateLogs({ password: "hidden-annotation", workspace: "private-workspace" }),
				),
			),
		);
	}
	return diagnostics === "success" ? Effect.logInfo("Preflight ready").pipe(Effect.annotateLogs({ app: "board" })) : Effect.void;
}

export function preflight(mode: "http" | "migrate" | "check" | "wait", deferred = false, diagnostics?: "failure" | "success") {
	return host.trait(
		"configured",
		`${mode} host validates its app ID before startup${deferred ? " with deferred construction" : ""}`,
		function* (state) {
			const validation = Layer.effect(
				AppId,
				Effect.gen(function* () {
					state.lifecycle.push("preflight");
					yield* preflightDiagnostic(diagnostics);
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
			const databaseUrl = databaseOf(state).url;
			const table = "preflight_migrations";
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
			if (mode === "check" || mode === "wait") {
				yield* Layer.build(appDatabase({ config, migrations: { loader, table }, postgresSettings: {} })).pipe(Effect.scoped);
				state.lifecycle.length = 0;
			}
			const application = Effect.gen(function* () {
				yield* AppId;
				state.lifecycle.push("constructing");
				return options;
			});
			state.build = () =>
				deferred
					? appHost({ application, config, migrations, postgresSettings: {}, preflight: validation })
					: appHost({ postgresSettings: {}, ...options, config: { ...state.config, ...config }, migrations, preflight: validation });
		},
	);
}
