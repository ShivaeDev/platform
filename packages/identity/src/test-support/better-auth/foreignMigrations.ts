import { betterAuth } from "better-auth";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Schema } from "effect";
import { HttpRouter } from "effect/http";
import { memoryStore } from "@shivaedev/rate-limit/memoryStore.ts";
import { signedInUser } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { assertBetterAuthSchema } from "#server/better-auth/adapters/assertSchema.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthMount } from "#server/better-auth/adapters/mount.ts";
import {
	foreignAuthSchema,
	removeForeignAuthColumn,
	removeForeignAuthTable,
	storedForeignSchema,
} from "#server/better-auth/test-support/foreignSchema.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl, postgres } from "#test/postgres.ts";

const ORIGIN = "http://localhost:3000";
const Session = Schema.Struct({ user: Schema.Struct({ email: Schema.String, name: Schema.String }) });

export const foreignMigrations = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const options = {
			account: { modelName: "Account" },
			"baseURL": ORIGIN,
			database: yield* betterAuthDatabase(),
			emailAndPassword: { enabled: true },
			logger: { disabled: true },
			plugins: [testUtils()],
			secret: "foreign-migrations-story-secret-at-least-32-characters",
			session: { cookieCache: { enabled: false }, modelName: "Session" },
			user: { modelName: "User" },
			verification: { modelName: "Verification" },
		};
		const application = yield* Effect.cached(
			Effect.gen(function* () {
				yield* assertBetterAuthSchema(options);
				const mounted = yield* betterAuthMount(options).pipe(
					Effect.provide(memoryStore),
					Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))),
				);
				const app = HttpRouter.toWebHandler(mounted.routes, { disableLogger: true });
				yield* Effect.addFinalizer(() => Effect.promise(() => app.dispose()));
				return app;
			}),
		);
		return { application, credentials: new Map<string, Headers>(), options };
	},
	layer: postgres,
	name: "auth on externally migrated tables",
	runIf: databaseUrl !== undefined,
	stages: ["schema", "accounts", "fault"],
	verbs: (engine, story) => ({
		session: (name: string) =>
			Effect.gen(function* () {
				story.tell(`${name} asks the mounted auth provider for their session`);
				const headers = engine.credentials.get(name);
				if (headers === undefined) {
					return yield* Effect.die(`No session exists for ${name}`);
				}
				const app = yield* engine.application;
				const response = yield* Effect.promise(() => app.handler(new Request(`${ORIGIN}/api/auth/get-session`, { headers })));
				const body = yield* Effect.promise(() => response.json());
				return { status: response.status, user: (yield* Schema.decodeUnknownEffect(Session)(body)).user };
			}),
		start: () => {
			story.tell("the application checks the externally managed schema and starts its auth mount");
			return engine.application.pipe(
				Effect.as("started"),
				Effect.catchTag("BetterAuthSchemaDrift", (error) => Effect.succeed({ missing: error.missing, reason: error.message })),
			);
		},
		storedSchema: () => storedForeignSchema,
	}),
});

export const externallyCreatedSchema = foreignMigrations.trait(
	"schema",
	"an application migration created PascalCase auth tables and an extra application column without identity's migrator",
	() => foreignAuthSchema,
);

export const existingForeignSession = foreignMigrations.trait(
	"accounts",
	"alice already has an auth session in the external schema",
	function* (engine) {
		const { headers } = yield* signedInUser(betterAuth(engine.options), { email: "alice@foreign.test", name: "alice" });
		engine.credentials.set("alice", headers);
	},
);

export const missingForeignColumn = foreignMigrations.trait(
	"fault",
	"the external user table is missing emailVerified",
	() => removeForeignAuthColumn,
);

export const missingForeignTable = foreignMigrations.trait("fault", "the external verification table is missing", () => removeForeignAuthTable);
