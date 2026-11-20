import { Data, Effect, Redacted } from "effect";
import { Migrator, SqlClient } from "effect/sql";
import { ChangeObserver, transact } from "@shivaedev/sql/transact.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { migrateBetterAuth } from "#server/better-auth/adapters/migrate.ts";
import { authTestDatabase } from "#server/better-auth/testDatabase.ts";
import { compositionHost, compositionOptions, signUpAlice } from "#test/better-auth/compositionHost.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { databaseUrl } from "#test/postgres.ts";
import { recordPublished } from "#test/recordPublished.ts";

class RegistrationCancelled extends Data.TaggedError("RegistrationCancelled")<{ readonly status: number }> {}

const postgres = makePostgresTestLayer({
	maxConnections: 3,
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
	url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled"),
});

export const applicationAuthTransactions = storyKit({
	around: withIdentityDatabase,
	clock: storyClock,
	*create() {
		const sql = yield* SqlClient.SqlClient;
		yield* migrateBetterAuth(compositionOptions);
		yield* sql`create table registrations (email text primary key)`;
		yield* sql`create table registration_notes (kind text primary key)`;
		const announced: unknown[] = [];
		const state = { refuseAccount: false, signOutDuringRefresh: false, transactionLocal: false };
		const startup = yield* compositionHost(state).pipe(Effect.provideService(ChangeObserver, recordPublished(announced)));
		return { announced, cookie: "", sql, startup, state, storage: yield* authTestDatabase };
	},
	layer: postgres,
	name: "application and auth transaction composition",
	runIf: databaseUrl !== undefined,
	stages: ["adapter", "admission", "refresh"],
	verbs: (engine, story) => ({
		announcedLists: () => Effect.sync(() => engine.announced.filter((key) => typeof key === "string" && !key.includes(":"))),
		refreshAlice: () => {
			story.tell("alice's session refreshes while another tab signs her out");
			engine.announced.splice(0);
			return Effect.tryPromise(() => engine.startup.auth.api.getSession({ asResponse: true, headers: new Headers({ cookie: engine.cookie }) })).pipe(
				Effect.map((response) => ({
					cookie: response.headers.getSetCookie().some((cookie) => /session_token=;.*Max-Age=0/u.test(cookie)) ? "cleared" : "kept",
					status: response.status,
				})),
			);
		},
		registerAlice: (outcome: "commit" | "rollback") =>
			Effect.gen(function* () {
				story.tell(`alice registers through auth and the application, then the application ${outcome}s`);
				const host = engine.state.transactionLocal ? yield* compositionHost(engine.state) : engine.startup;
				yield* engine.sql`insert into registrations (email) values ('alice@composition.test')`;
				const response = yield* signUpAlice(host);
				if (outcome === "rollback") {
					return yield* new RegistrationCancelled({ status: response.status });
				}
				return response.status;
			}).pipe(
				transact(),
				Effect.catchTag("RegistrationCancelled", (error) => Effect.succeed(error.status)),
				Effect.provideService(ChangeObserver, recordPublished(engine.announced)),
			),
		signUpAlice: () => {
			story.tell("alice signs up through the startup auth mount");
			return signUpAlice(engine.startup).pipe(
				Effect.tap((response) =>
					Effect.sync(() => {
						engine.cookie = response.headers
							.getSetCookie()
							.map((cookie) => cookie.split(";")[0])
							.join("; ");
					}),
				),
				Effect.flatMap((response) => Effect.tryPromise(async () => ({ body: await response.json(), status: response.status }))),
			);
		},
		storedHookWrites: () => engine.sql<{ kind: string }>`select kind from registration_notes order by kind`,
		storedRegistrations: () => engine.sql<{ email: string }>`select email from registrations order by email`,
		storedUsers: () => Effect.map(engine.storage.users, (rows) => rows.map(({ email }) => email)),
	}),
});

export const transactionLocalAuth = applicationAuthTransactions.trait(
	"adapter",
	"the registration builds its auth adapter and mount inside transact",
	(engine) => {
		engine.state.transactionLocal = true;
	},
);

export const refusingAccountHook = applicationAuthTransactions.trait(
	"admission",
	"the account hook writes application SQL then refuses account creation",
	(engine) => {
		engine.state.refuseAccount = true;
	},
);

export const signOutDuringRefresh = applicationAuthTransactions.trait(
	"refresh",
	"a session refresh finds its row deleted by a sign-out in another tab",
	(engine) => {
		engine.state.signOutDuringRefresh = true;
	},
);
