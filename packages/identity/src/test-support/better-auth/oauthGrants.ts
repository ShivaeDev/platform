import { betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { admin, jwt, testUtils } from "better-auth/plugins";
import { DateTime, Effect, Layer, Option } from "effect";
import { SqlClient } from "effect/sql";
import { AuthUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { databaseUrl, postgres } from "@shivaedev/test-sql/server/emptyPostgres.ts";
import { withIsolatedDatabase } from "@shivaedev/test-sql/server/withIsolatedDatabase.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { betterAuthDatabase } from "#server/better-auth/adapters/database.ts";
import { betterAuthOauthGrants } from "#server/better-auth/adapters/oauthGrants.ts";
import { betterAuthOauthProvider } from "#server/better-auth/adapters/oauthProvider.ts";
import { signedInUser } from "#server/better-auth/testing.ts";
import { OauthGrants } from "#server/oauthGrants.ts";
import { grantBanVerbs } from "./grantBanVerbs.ts";

type Person = "alice" | "bob";

function failure<A>(effect: Effect.Effect<A, AuthUnavailable>) {
	return effect.pipe(
		Effect.match({
			onFailure: (error) => (error instanceof AuthUnavailable && error.cause !== undefined ? "auth unavailable with cause" : "missing cause"),
			onSuccess: () => "succeeded",
		}),
	);
}

export const oauthGrants = storyKit({
	around: withIsolatedDatabase,
	clock: Effect.runSync(DateTime.now),
	*create() {
		const database = yield* betterAuthDatabase();
		const options = {
			"baseURL": "http://localhost:3000",
			database,
			logger: { disabled: true },
			plugins: [
				admin(),
				jwt(),
				testUtils(),
				betterAuthOauthProvider({ consentPage: "/consent", loginPage: "/login", resource: "http://localhost:3000/mcp" }),
			],
			secret: "identity-grant-story-secret-with-at-least-32-characters",
		};
		yield* Effect.promise(async () => (await getMigrations(options)).runMigrations());
		const auth = betterAuth(options);
		const people = new Map<Person, string>();
		for (const name of ["alice", "bob"] as const) {
			const session = yield* signedInUser(auth, { email: `${name}@grants.test`, name });
			people.set(name, session.user.id);
		}
		const denied = new Set<string>();
		const layer = betterAuthOauthGrants({ admitsUser: (id) => Effect.sync(() => !denied.has(id)), auth });
		return { auth, context: yield* Layer.build(layer), denied, grantIds: new Map<string, string>(), people, sql: yield* SqlClient.SqlClient };
	},
	inspect: ({ people }) => ({ people: [...people.keys()] }),
	layer: postgres,
	name: "identity OAuth grants on PostgreSQL",
	runIf: databaseUrl !== undefined,
	stages: ["grants"],
	verbs: (engine, story) => {
		function id(name: Person) {
			const found = engine.people.get(name);
			if (found === undefined) {
				throw new Error(`${name} has no identity`);
			}
			return found;
		}
		const service = Effect.provideContext(OauthGrants, engine.context);
		return {
			...grantBanVerbs(engine.auth, id, story.tell),
			deny: (name: Person) =>
				Effect.sync(() => {
					story.tell(`admission denies ${name}`);
					engine.denied.add(id(name));
				}),
			list: (name: Person) =>
				Effect.flatMap(service, (grants) => grants.list(id(name), { limit: 100 })).pipe(
					Effect.map((grants) => [...grants].sort((a, b) => a.clientId.localeCompare(b.clientId))),
				),
			listFailure: () => failure(Effect.flatMap(service, (grants) => grants.list(id("alice"), { limit: 100 }))),
			lookupFailure: () =>
				failure(
					Effect.flatMap(service, (grants) => grants.resolveGrant(engine.grantIds.get(`${id("alice")}-desktop`) ?? "", id("alice"), "desktop")),
				),
			revokeAllClients: (name: Person) =>
				Effect.flatMap(service, (grants) => {
					story.tell(`${name} revokes every client`);
					return grants.revokeAllClients(id(name));
				}),
			revokeAllFailure: () => failure(Effect.flatMap(service, (grants) => grants.revokeAllClients(id("alice")))),
			revokeClient: (name: Person, client: string) =>
				Effect.flatMap(service, (grants) => {
					story.tell(`${name} revokes ${client}`);
					return grants.revokeClient(id(name), client);
				}),
			revokeClientFailure: () => failure(Effect.flatMap(service, (grants) => grants.revokeClient(id("alice"), "desktop"))),
			storageFails: () => {
				story.tell("grant storage becomes unavailable");
				return engine.sql`alter table "oauthConsent" rename to "unavailableConsent"`;
			},
			storedTokens: (name: Person) =>
				Effect.gen(function* () {
					const { adapter } = yield* Effect.promise(() => engine.auth.$context);
					const where = [{ field: "userId", value: id(name) }];
					return yield* Effect.promise(async () => ({
						access: await adapter.count({ model: "oauthAccessToken", where }),
						refresh: await adapter.count({ model: "oauthRefreshToken", where }),
					}));
				}),
			subject: (name: Person, client: string, grantOwner = name) =>
				Effect.flatMap(service, (grants) => grants.resolveGrant(engine.grantIds.get(`${id(grantOwner)}-${client}`) ?? "", id(name), client)).pipe(
					Effect.map(Option.match({ onNone: () => "refused", onSome: (grant) => grant.user.name })),
				),
		};
	},
});
