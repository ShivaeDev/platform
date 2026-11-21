import { Effect, Predicate, Redacted, Schema } from "effect";
import { Migrator, SqlClient, SqlSchema } from "effect/sql";
import * as TestClock from "effect/testing/TestClock";
import { clientOptions } from "@shivaedev/sql/clientOptions.ts";
import { collectRepositoryModels } from "@shivaedev/sql/RepositoryModels.ts";
import { passwordUser, signInAgain } from "@shivaedev/test-kits/identity/adapters/betterAuth.ts";
import { makePostgresTestLayer } from "@shivaedev/test-sql/server/postgres.ts";
import { answered, errorWords } from "@shivaedev/test-story/server/answers.ts";
import { storyKit } from "@shivaedev/test-story/server/storyKit.ts";
import { removedCredential, storedVerification, storedVerificationIdentifiers } from "#server/better-auth/test-support/accountDeletion.ts";
import type { HandOverPlan } from "#test/account-deletion/HandOverPlan.ts";
import { type AccountDeletionHost, accountDeletionHost, type SessionStorage } from "#test/account-deletion/host.ts";
import { ownedModels } from "#test/better-auth/ownedModels.ts";
import { storyClock, withIdentityDatabase } from "#test/clock.ts";
import { CURRENT_PASSWORD, PASSWORD_HASH } from "#test/passwords.ts";
import { databaseUrl } from "#test/postgres.ts";
import { ORIGIN } from "#test/rpc/harness.ts";

export type Person = "alice" | "bob";

interface Setup {
	readonly announced: unknown[];
	host: AccountDeletionHost | undefined;
	readonly people: Map<Person, { headers: Headers; readonly id: string }>;
	readonly plan: HandOverPlan["Service"];
	storage: SessionStorage;
}

// Applications build their client with clientOptions, so the owned tables' snake-case columns sit beneath camel-case fields.
const postgres = makePostgresTestLayer({
	...clientOptions({ url: Redacted.make(databaseUrl ?? "postgresql://integration-tests-disabled") }),
	migrations: { loader: Migrator.fromRecord({}), lockTimeout: "5 seconds" },
});

const Title = Schema.Struct({ title: Schema.String });
const Owner = Schema.Struct({ owner: Schema.String });

function emailOf(name: Person) {
	return `${name}@deletion.test`;
}

// The person reads a refusal's own words, so the readout keeps the message of a request rejection.
function refusalWords(error: unknown) {
	return Predicate.hasProperty(error, "_tag") && ["BadRequest", "PreconditionFailed", "TooManyRequests"].includes(String(error._tag))
		? `${errorWords(error)}: ${String(Reflect.get(error, "message"))}`
		: errorWords(error);
}

export const accountDeletion = storyKit({
	after: {
		*hosting(setup: Setup) {
			const host = yield* accountDeletionHost(setup.plan, setup.announced, setup.storage);
			setup.host = host;
			const sql = yield* SqlClient.SqlClient;
			yield* sql`create table notes (id serial primary key, title text not null, share_token text not null, user_id text not null)`;
			yield* sql`create table projects (id serial primary key, user_id text not null)`;
			for (const name of ["alice", "bob"] as const) {
				const role = name === "bob" ? "admin" : "user";
				const user = yield* passwordUser(host.auth, { email: emailOf(name), name, passwordHash: PASSWORD_HASH, role });
				const { headers } = yield* signInAgain(host.auth, user.id);
				setup.people.set(name, { headers: yield* host.cachedSession(headers), id: user.id });
				yield* sql`insert into notes (title, share_token, user_id) values (${`${name}'s note`}, ${`${name}-token`}, ${user.id})`;
				yield* sql`insert into projects (user_id) values (${user.id})`;
			}
			setup.plan.receiver = setup.people.get("bob")?.id ?? "";
			yield* Effect.all([ownedModels.notes, ownedModels.projects]);
		},
	},
	around: (effect) => withIdentityDatabase(effect.pipe(Effect.provide(collectRepositoryModels))),
	clock: storyClock,
	create: (): Setup => ({ announced: [], host: undefined, people: new Map(), plan: { mode: "none", receiver: "" }, storage: "database" }),
	inspect: ({ announced, plan, storage }) => ({ announced, handOver: plan.mode, sessions: storage }),
	layer: postgres,
	name: "account deletion",
	runIf: databaseUrl !== undefined,
	stages: ["hosting", "data"],
	verbs: (engine, story) => {
		function host() {
			if (engine.host === undefined) {
				throw new Error("The account deletion host has not started");
			}
			return engine.host;
		}
		function person(name: Person) {
			const found = engine.people.get(name);
			if (found === undefined) {
				throw new Error(`No account exists for ${name}`);
			}
			return found;
		}
		function nameOf(id: string) {
			return [...engine.people].find(([, account]) => account.id === id)?.[0] ?? id;
		}
		function signInRequest(name: Person) {
			return host().fetch("/api/auth/sign-in/email", {
				body: JSON.stringify({ email: emailOf(name), password: CURRENT_PASSWORD }),
				headers: { "content-type": "application/json", origin: ORIGIN },
				method: "POST",
			});
		}
		return {
			announcedKeys: () => Effect.sync(() => engine.announced.map((key) => String(key).replace(/:(?<id>.+)$/u, (_, id: string) => `:${nameOf(id)}`))),
			changeEmail: (name: Person, password: string) => {
				story.tell(`${name} asks Better Auth's /change-email route for a new address, confirming it with ${JSON.stringify(password)}`);
				return host()
					.fetch("/api/auth/change-email", {
						body: JSON.stringify({ newEmail: `${name}-new@deletion.test`, password }),
						headers: { "content-type": "application/json", cookie: person(name).headers.get("cookie") ?? "", origin: ORIGIN },
						method: "POST",
					})
					.pipe(Effect.map(({ status }) => status));
			},
			deleteAccount: (name: Person, password = CURRENT_PASSWORD) => {
				story.tell(
					`${name} asks to delete her account, confirming it with ${password === CURRENT_PASSWORD ? "her password" : JSON.stringify(password)}`,
				);
				return host()
					.client(person(name).headers)
					.pipe(
						Effect.flatMap((rpc) => rpc["identity.account.delete"]({ password })),
						Effect.as("deleted"),
						Effect.scoped,
						(effect) => answered(effect, refusalWords),
					);
			},
			deleteThroughBetterAuth: (name: Person) => {
				story.tell(`${name} posts her password to Better Auth's own /delete-user route`);
				return host()
					.fetch("/api/auth/delete-user", {
						body: JSON.stringify({ password: CURRENT_PASSWORD }),
						headers: { "content-type": "application/json", cookie: person(name).headers.get("cookie") ?? "", origin: ORIGIN },
						method: "POST",
					})
					.pipe(Effect.map(({ status }) => status));
			},
			removeThroughAdmin: (administrator: Person, name: Person) => {
				story.tell(`${administrator}, an administrator, posts ${name}'s id to Better Auth's /admin/remove-user route`);
				return host()
					.fetch("/api/auth/admin/remove-user", {
						body: JSON.stringify({ userId: person(name).id }),
						headers: { "content-type": "application/json", cookie: person(administrator).headers.get("cookie") ?? "", origin: ORIGIN },
						method: "POST",
					})
					.pipe(Effect.map(({ status }) => status));
			},
			request: (name: Person) => {
				story.tell(`${name} requests her protected profile`);
				return host()
					.client(person(name).headers)
					.pipe(
						Effect.flatMap((rpc) => rpc["profile.read"]()),
						Effect.map(({ name: shown }) => shown),
						Effect.scoped,
						answered,
					);
			},
			sessionCheck: (name: Person) =>
				host()
					.fetch("/api/auth/get-session", { headers: { cookie: person(name).headers.get("cookie") ?? "" } })
					.pipe(
						Effect.flatMap((response) => Effect.promise(() => response.json())),
						Effect.map((body) => (body === null ? "signed out" : "signed in")),
					),
			signIn: (name: Person) => signInRequest(name).pipe(Effect.map(({ status }) => (status === 200 ? "signed in" : `refused with ${status}`))),
			storedNotes: Effect.fn("AccountDeletionStory.storedNotes")(function* () {
				const sql = yield* SqlClient.SqlClient;
				const rows = yield* SqlSchema.findAll({ execute: () => sql`select title from notes order by title`, Request: Schema.Void, Result: Title })(
					undefined,
				);
				return rows.map(({ title }) => title);
			}),
			storedProjectOwners: Effect.fn("AccountDeletionStory.storedProjectOwners")(function* () {
				const sql = yield* SqlClient.SqlClient;
				const rows = yield* SqlSchema.findAll({
					execute: () => sql`select user_id as owner from projects order by id`,
					Request: Schema.Void,
					Result: Owner,
				})(undefined);
				return rows.map(({ owner }) => nameOf(owner));
			}),
			storedVerifications: () =>
				storedVerificationIdentifiers.pipe(
					Effect.map((identifiers) =>
						identifiers
							.map((identifier) => [...engine.people].reduce((named, [name, { id }]) => named.replaceAll(id, name), identifier))
							.sort((left, right) => left.localeCompare(right)),
					),
				),
			waits: (duration: `${number} ${"second" | "seconds"}`) => {
				story.tell(`${duration} pass`);
				return TestClock.adjust(duration);
			},
			writesNote: (name: Person, title: string) => {
				story.tell(`${name} writes the note ${JSON.stringify(title)} through her protected profile`);
				return host()
					.client(person(name).headers)
					.pipe(
						Effect.flatMap((rpc) => rpc["profile.note"]({ title })),
						Effect.as("written"),
						Effect.scoped,
						answered,
					);
			},
		};
	},
});

export const handOverGivesProjects = accountDeletion.trait("data", "the application's hand-over gives the person's projects to bob", (engine) =>
	Effect.sync(() => {
		engine.plan.mode = "gives projects to bob";
	}),
);

export const handOverFails = accountDeletion.trait(
	"data",
	"the application's hand-over gives the person's projects to bob and then fails",
	(engine) =>
		Effect.sync(() => {
			engine.plan.mode = "fails after giving projects to bob";
		}),
);

export const bookmarkOfAliceNote = accountDeletion.trait(
	"data",
	"bob's bookmark, in a table no owned model covers, still references alice's note",
	function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table bookmarks (id serial primary key, note_id integer not null references notes (id))`;
		yield* sql`insert into bookmarks (note_id) select id from notes where title = 'alice''s note'`;
	},
);

export const requiredReviewAuthor = accountDeletion.trait(
	"data",
	"alice wrote a review whose author key nulls itself on delete, but the column refuses null",
	function* (engine) {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table reviews (id serial primary key, author_id text not null references "user" (id) on delete set null)`;
		yield* sql`insert into reviews (author_id) values (${engine.people.get("alice")?.id ?? ""})`;
	},
);

export const passwordless = accountDeletion.trait("data", "alice signs in through a provider only and has no password", function* (engine) {
	yield* removedCredential(engine.people.get("alice")?.id ?? "");
});

export const pendingVerifications = accountDeletion.trait(
	"data",
	"alice and bob each have a pending password reset, email verification code and change-email code",
	function* (engine) {
		for (const name of ["alice", "bob"] as const) {
			const id = engine.people.get(name)?.id ?? "";
			yield* storedVerification(`reset-password:${name}-token`, id);
			yield* storedVerification(`email-verification-otp-${emailOf(name)}`, "123456:0");
			yield* storedVerification(`change-email-otp-${id}:${name}-new@deletion.test`, "123456:0");
		}
	},
);

export const lookalikeAddressCodes = accountDeletion.trait(
	"data",
	"mary-alice@deletion.test, whose address ends in alice's, has pending sign-in, verification and password-reset codes",
	function* () {
		for (const type of ["sign-in", "email-verification", "forget-password"]) {
			yield* storedVerification(`${type}-otp-mary-alice@deletion.test`, "654321:0");
		}
	},
);

export function sessionsIn(storage: SessionStorage) {
	return accountDeletion.trait("hosting", `the auth declaration keeps sessions with ${storage}`, (setup) => {
		setup.storage = storage;
	});
}
