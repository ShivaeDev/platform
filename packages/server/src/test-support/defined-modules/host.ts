import { Effect, Layer, Option, type Redacted } from "effect";
import { SessionPolicy } from "@shivaedev/identity/server/SessionPolicy.ts";
import { appHost } from "#appDatabase.ts";
import type { appModules } from "#appModules.ts";
import { TestRoles } from "#test/permissions.ts";

type Modules = Effect.Success<ReturnType<typeof appModules>>;

const sessions = Layer.succeed(SessionPolicy, {
	origin: () => true,
	provider: {
		get: (headers) =>
			Effect.succeed(
				headers.authorization === "alice"
					? Option.some({ user: { email: "alice@example.test", id: "alice", name: "Alice", role: "user" } })
					: Option.none(),
			),
	},
	roles: TestRoles,
});

// The application form is the one the starter uses: its application Effect builds the module services itself and hands the host the built context.
function builtInApplication(modules: Modules, config: { readonly databaseUrl: Redacted.Redacted<string>; readonly port: number }) {
	const { group, handlers, requestServices } = modules;
	const application = Effect.map(Layer.build(modules.services), (built) => ({
		config,
		group,
		handlers,
		requestServices,
		services: Layer.succeedContext(built),
		sessions,
	}));
	return appHost({ application, config, migrations: modules.migrations, postgresSettings: {} });
}

export function startAppHost<A, E, R>(
	form: "app" | "application",
	modules: Modules,
	configured: Layer.Layer<A, E, R>,
	databaseUrl: Redacted.Redacted<string>,
) {
	const config = { databaseUrl, port: 0 };
	return Effect.suspend(() =>
		form === "application"
			? Layer.build(builtInApplication(modules, config).pipe(Layer.provide(configured)))
			: Layer.build(appHost({ postgresSettings: {}, ...modules, config, sessions }).pipe(Layer.provide(configured))),
	);
}
