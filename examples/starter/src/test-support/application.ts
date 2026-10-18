import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { storyKit } from "@shivaedev/test-story/storyKit.ts";
import { type HostOptions, startHost } from "#test-support/host.ts";
import { postgres } from "#test-support/postgres.ts";
import { requests } from "#test-support/requests.ts";
import { storyDatabase } from "#test-support/storyDatabase.ts";
import type { Engine } from "./applicationState.ts";
import { applicationVerbs } from "./applicationVerbs.ts";
import { DatabaseLifetime } from "./DatabaseLifetime.ts";

export const app = storyKit({
	after: {
		*hosting(engine) {
			engine.host = yield* startHost(engine.hostOptions);
		},
	},
	around: storyDatabase,
	clock: "live",
	create: (): Effect.Effect<Engine> =>
		Effect.gen(function* () {
			const databaseLifetime = yield* DatabaseLifetime;
			return { actors: new Map(), databaseLifetime, existingNotes: new Map(), host: undefined, hostOptions: {}, tell: () => undefined };
		}),
	inspect: (engine) => ({ accounts: [...engine.actors.keys()], baseUrl: engine.host?.baseUrl, deployed: engine.hostOptions.deployed ?? false }),
	layer: postgres,
	name: "app",
	stages: ["hosting", "accounts", "notes"],
	verbs: applicationVerbs,
});

export function signedIn(name = "alice") {
	return app.trait("accounts", `${name} is signed in`, function* (engine) {
		if (engine.host === undefined) {
			return yield* Effect.die("Host has not started");
		}
		const http = requests(engine.host, (line) => engine.tell(line));
		const cookie = yield* http.authenticate(name);
		engine.actors.set(name, { cookie, notes: yield* http.notes(cookie) });
	});
}

export function behindProxy(options: Pick<HostOptions, "trustedProxy" | "authClientIpHeader"> = { trustedProxy: "127.0.0.1" }) {
	return app.trait("hosting", "the app is behind an HTTPS forwarding proxy", (engine) => {
		engine.hostOptions = { ...engine.hostOptions, deployed: true, ...options };
	});
}

export function authRateLimiting(enabled: boolean) {
	return app.trait("hosting", `auth rate limiting is ${enabled ? "enabled" : "disabled"}`, (engine) => {
		engine.hostOptions = { ...engine.hostOptions, rateLimitEnabled: enabled };
	});
}

export function legacyNote(title: string) {
	return app.trait("notes", `PostgreSQL contains the unowned note ${JSON.stringify(title)}`, function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`insert into notes (title) values (${title})`;
	});
}

export function rejectedNoteJobs() {
	return app.trait("notes", "PostgreSQL rejects word-count jobs", function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`alter table pgboss.job add constraint reject_note_jobs check (name <> 'count-note-words')`;
	});
}

export function rejectedNoteCommits() {
	return app.trait("notes", "PostgreSQL rejects note writes at commit", function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create function reject_note_commit() returns trigger language plpgsql as $$
			begin raise exception 'rejected at commit'; end;
		$$`;
		yield* sql`create constraint trigger reject_note_commit after insert on notes
			deferrable initially deferred for each row execute function reject_note_commit()`;
	});
}

export function notesPredatingMigration(migration: 4 | 5, title: string) {
	return app.trait("notes", `a saved note predates migration ${migration}`, function* (engine) {
		const actor = engine.actors.get("alice");
		if (actor === undefined) {
			return yield* Effect.die("Alice must be signed in");
		}
		const note = yield* actor.notes.create({ title });
		engine.existingNotes.set(title, note);
		const sql = yield* SqlClient.SqlClient;
		if (migration === 4) {
			yield* sql`alter table notes drop column "wordCount"`;
		}
		yield* sql`alter table notes drop column version`;
		yield* sql`delete from app_migrations where migration_id >= ${migration}`;
	});
}
