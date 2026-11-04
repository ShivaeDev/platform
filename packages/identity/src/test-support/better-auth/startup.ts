import { Context, Deferred, Effect, Fiber, Layer, Logger } from "effect";
import { SqlClient } from "effect/sql";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { countQueries } from "#test/auth/countQueries.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";

class Mounted extends Context.Service<Mounted, void>()("@shivaedev/identity/test/authStartup/Mounted") {}

const options = {
	advanced: { database: { validateSchema: true } },
	"baseURL": "http://localhost:3000",
	emailAndPassword: { enabled: true },
	logger: { disabled: true },
	secret: "auth-startup-story-secret-at-least-32-characters",
};

export const authStartup = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const storage = yield* authTestDatabase;
		yield* storage.migrate(options);
		const initialization: { failure?: Error } = {};
		const logs: unknown[] = [];
		const logger = Logger.make(({ message }) => logs.push(message));
		const initializing = Promise.withResolvers<void>();
		const initialized = Promise.withResolvers<void>();
		const checking = yield* Deferred.make<void>();
		const checked = yield* Deferred.make<void>();
		const beforeQuery = Deferred.succeed(checking, undefined).pipe(Effect.andThen(Deferred.await(checked)));
		const observed = countQueries(yield* SqlClient.SqlClient, beforeQuery);
		async function initializeContext() {
			initializing.resolve();
			await initialized.promise;
			if (initialization.failure !== undefined) {
				throw initialization.failure;
			}
		}
		const layer = Layer.effect(Mounted)(
			Effect.gen(function* () {
				const database = yield* betterAuthDatabase().pipe(Effect.provideService(SqlClient.SqlClient, observed.sql));
				return yield* betterAuthMount({
					...options,
					database,
					plugins: [{ id: "held-initialization", init: initializeContext }],
				}).pipe(Effect.provide(memoryStore), Effect.asVoid);
			}),
		).pipe(Layer.provide(Logger.layer([logger])));
		return { checked, checking, initialization, initialized, initializing, layer, logs, storage };
	},
	layer: postgres,
	name: "authentication startup",
	runIf: databaseUrl !== undefined,
	stages: ["schema"],
	verbs: (engine, story) => {
		function startBuild() {
			return Layer.build(engine.layer).pipe(Effect.forkScoped);
		}
		let build: Effect.Success<ReturnType<typeof startBuild>> | undefined;
		function building() {
			if (build === undefined) {
				throw new Error("The mount Layer has not been built");
			}
			return build;
		}
		return {
			awaitSchemaCheck: () => Deferred.await(engine.checking),
			beginBuild: Effect.fnUntraced(function* () {
				story.tell("the application begins building its auth mount Layer");
				build = yield* startBuild();
				yield* Effect.addFinalizer(() =>
					Effect.sync(() => engine.initialized.resolve()).pipe(Effect.andThen(Deferred.succeed(engine.checked, undefined))),
				);
				yield* Effect.promise(() => engine.initializing.promise);
			}),
			buildOutcome: () =>
				Fiber.join(building()).pipe(
					Effect.as("ready"),
					Effect.catchTag("AuthUnavailable", () => Effect.succeed("auth unavailable")),
				),
			buildState: () => Effect.sync(() => (building().pollUnsafe() === undefined ? "waiting" : "finished")),
			finishInitialization: () => {
				story.tell("the auth provider finishes initializing its context");
				return Effect.sync(() => engine.initialized.resolve());
			},
			recordedProviderFailures: () => Effect.sync(() => engine.logs),
			releaseSchemaCheck: () => {
				story.tell("PostgreSQL is allowed to answer the schema check");
				return Deferred.succeed(engine.checked, undefined);
			},
		};
	},
});

export const missingImageColumn = authStartup.trait(
	"schema",
	"the user image column is missing before startup",
	(engine) => engine.storage.omitImageColumn,
);

export const unavailableContext = authStartup.trait("schema", "the auth provider refuses context initialization", (engine) => {
	engine.initialization.failure = new Error("Provider context initialization refused");
});
