import { createServer } from "node:http";
import { NodeHttpServer } from "@effect/platform-node";
import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { testUtils } from "better-auth/plugins";
import { ConfigProvider, Effect, Layer, Option, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/http";
import * as HttpStatus from "effect/http/HttpStatus";
import * as NetAddress from "effect/net/NetAddress";
import { PostgresTestDatabase } from "@shivaedev/test-sql/server/database.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { SessionUserSchema } from "#identity.ts";
import { authDatabase, betterAuthMount } from "#server/better-auth/mount.ts";
import { sweepExpiredSessions } from "#server/better-auth/sweepExpiredSessions.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { signedInUser } from "#server/better-auth/testing.ts";

type Person = "alice" | "bob";

const SessionBody = Schema.NullOr(Schema.Struct({ user: SessionUserSchema }));

interface MintedAccount {
	readonly headers: Headers;
	readonly userId: string;
}

function account(engine: { readonly accounts: Map<Person, MintedAccount> }, person: Person) {
	const minted = engine.accounts.get(person);
	if (minted === undefined) {
		throw new Error(`No minted account exists for ${person}`);
	}
	return minted;
}

export const authStorage = storyKit({
	after: {
		*hosting(engine) {
			if (!engine.hosting) {
				return;
			}
			const mounted = yield* betterAuthMount(engine.options).pipe(
				Effect.provide(ConfigProvider.layer(ConfigProvider.fromEnv({ env: { "AUTH_RATE_LIMIT_ENABLED": "false" } }))),
			);
			const context = yield* Layer.build(
				HttpRouter.serve(mounted.routes, { disableLogger: true }).pipe(
					Layer.provideMerge(NodeHttpServer.layer(createServer, { host: "127.0.0.1", port: 0 })),
				),
			);
			const server = yield* HttpServer.HttpServer.pipe(Effect.provideContext(context));
			if (!NetAddress.isInetAddress(server.address)) {
				return yield* Effect.die("Auth storage stories require a TCP listener");
			}
			engine.baseUrl = `http://127.0.0.1:${server.address.port}`;
		},
	},
	around: withIsolatedDatabase,
	clock: "live",
	*create() {
		const database = yield* PostgresTestDatabase;
		const pool = yield* authDatabase(database.url);
		const options = {
			advanced: { database: { validateSchema: true } },
			database: pool,
			emailAndPassword: { enabled: true },
			logger: { disabled: true },
			secret: "auth-storage-story-secret-with-at-least-32-characters",
			session: { cookieCache: { enabled: false } },
		};
		yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
		return {
			accounts: new Map<Person, MintedAccount>(),
			auth: betterAuth({ ...options, "baseURL": "http://127.0.0.1:3000", plugins: [testUtils()] }),
			baseUrl: "",
			hosting: true,
			options,
			storage: authTestDatabase(pool),
			swept: Option.none<number>(),
		};
	},
	inspect: (engine) => ({ accounts: [...engine.accounts.keys()], baseUrl: engine.baseUrl, swept: Option.getOrUndefined(engine.swept) }),
	layer: postgres,
	name: "auth storage fixtures",
	runIf: databaseUrl !== undefined,
	stages: ["accounts", "expiry", "schema", "hosting"],
	verbs: (engine, story) => ({
		expireAllSessions: () => {
			story.tell("every stored auth session expires");
			return engine.storage.expireSessions();
		},
		expireSessions: (person: Person) => {
			story.tell(`${person}'s stored auth sessions expire`);
			return engine.storage.expireSessions(account(engine, person).userId);
		},
		signedInAs: (person: Person) =>
			Effect.tryPromise(async () => {
				story.tell(`${person}'s cookie asks the mounted auth provider whose session it holds`);
				const response = await fetch(`${engine.baseUrl}/api/auth/get-session`, { headers: account(engine, person).headers });
				if (response.status === HttpStatus.fromLiteral("ServiceUnavailable")) {
					return "auth unavailable";
				}
				if (!response.ok) {
					return `failed with HTTP ${response.status}`;
				}
				const { user } = Schema.decodeUnknownSync(SessionBody)(await response.json()) ?? { user: undefined };
				return user?.name ?? "signed out";
			}),
		storedSessionRows: () => engine.storage.sessions,
		storedSessions: (person: Person) =>
			Effect.map(engine.storage.sessions, (rows) => rows.filter(({ userId }) => userId === account(engine, person).userId).length),
		storedUserRows: () => engine.storage.users,
		storedUsers: () => Effect.map(engine.storage.users, (rows) => rows.map(({ email }) => email.slice(0, email.indexOf("@")))),
		sweepExpiredSessions: () =>
			Effect.gen(function* () {
				story.tell("the worker sweeps expired auth sessions through the application SQL client");
				engine.swept = Option.some(yield* sweepExpiredSessions);
			}),
		sweptSessions: () => Effect.sync(() => Option.getOrThrowWith(engine.swept, () => new Error("No sweep has run"))),
		userId: (person: Person) => Effect.sync(() => account(engine, person).userId),
	}),
});

export function mintedAccounts() {
	return authStorage.trait("accounts", "alice and bob already hold one auth session each", function* (engine) {
		for (const person of ["alice", "bob"] as const) {
			const { headers, user } = yield* Effect.promise(() => signedInUser(engine.auth, { email: `${person}@storage.test`, name: person }));
			engine.accounts.set(person, { headers, userId: user.id });
		}
	});
}

export function expiredSession(person: Person) {
	return authStorage.trait("expiry", `${person}'s stored auth session has expired`, (engine) =>
		engine.storage.expireSessions(account(engine, person).userId),
	);
}

export function missingImageColumn() {
	return authStorage.trait("schema", "the default auth schema is missing its user image column", (engine) => engine.storage.omitImageColumn);
}

export const withoutAuthHost = authStorage.trait("hosting", "the worker never mounts Better Auth", (engine) => {
	engine.hosting = false;
});
