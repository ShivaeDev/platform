import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { AccountPreferenceRows } from "#server/account-preferences/Rows.ts";
import { accountPreferencesMigration } from "#server/accountPreferencesMigration.ts";
import { accountData } from "#server/better-auth/accountData.ts";
import { mappedExportUser } from "#server/better-auth/test-support/exportAccounts.ts";
import { ownedData } from "#test/better-auth/ownedData.ts";
import { ownedModels } from "#test/better-auth/ownedModels.ts";

const PEOPLE = ["alice", "bob"] as const;

export const exportedTables = ownedData.trait(
	"tables",
	"alice and bob own notes, which hold a server-only share token, and bookmarks; one bookmark has no owner",
	function* (engine) {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table notes (
			id serial primary key,
			title text not null,
			share_token text not null,
			user_id text not null references "user" (id) on delete cascade
		)`;
		yield* sql`create table bookmarks (id serial primary key, title text not null, user_id text references "user" (id) on delete set null)`;
		for (const name of PEOPLE) {
			const userId = engine.users.get(name);
			yield* sql`insert into notes (title, share_token, user_id) values (${`${name}'s note`}, ${`${name}-share-token`}, ${userId})`;
			yield* sql`insert into bookmarks (title, user_id) values (${`${name}'s bookmark`}, ${userId})`;
		}
		yield* sql`insert into bookmarks (title) values ('unowned bookmark')`;
		yield* ownedModels.notes;
		yield* ownedModels.bookmarks;
	},
);

export const restrictChain = ownedData.trait(
	"tables",
	"alice and bob each own a project, a task in it and a comment on it, and each reference holds its row back with RESTRICT or NO ACTION",
	function* (engine) {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table projects (id integer primary key, user_id text not null)`;
		yield* sql`create table tasks (id integer primary key, project_id integer not null references projects (id) on delete restrict, user_id text not null)`;
		yield* sql`create table comments (id integer primary key, task_id integer not null references tasks (id) on delete no action, user_id text not null)`;
		for (const [index, name] of PEOPLE.entries()) {
			const userId = engine.users.get(name);
			yield* sql`insert into projects (id, user_id) values (${index}, ${userId})`;
			yield* sql`insert into tasks (id, project_id, user_id) values (${index}, ${index}, ${userId})`;
			yield* sql`insert into comments (id, task_id, user_id) values (${index}, ${index}, ${userId})`;
		}
		yield* Effect.all([ownedModels.comments, ownedModels.projects, ownedModels.tasks]);
	},
);

export const ownedCycle = ownedData.trait(
	"tables",
	"alice's draft and its revision hold each other back with RESTRICT, and the draft holds back her label",
	function* (engine) {
		const sql = yield* SqlClient.SqlClient;
		const userId = engine.users.get("alice");
		yield* sql`create table labels (id integer primary key, user_id text not null)`;
		yield* sql`create table drafts (id integer primary key, label_id integer references labels (id) on delete restrict, revision_id integer, user_id text not null)`;
		yield* sql`create table revisions (id integer primary key, draft_id integer references drafts (id) on delete restrict, user_id text not null)`;
		yield* sql`alter table drafts add foreign key (revision_id) references revisions (id) on delete restrict`;
		yield* sql`insert into labels (id, user_id) values (1, ${userId})`;
		yield* sql`insert into drafts (id, label_id, user_id) values (1, 1, ${userId})`;
		yield* sql`insert into revisions (id, draft_id, user_id) values (1, 1, ${userId})`;
		yield* Effect.all([ownedModels.drafts, ownedModels.labels, ownedModels.revisions]);
	},
);

export const storedPreferences = ownedData.trait("tables", "identity stores alice's and bob's account preferences", function* (engine) {
	yield* accountPreferencesMigration;
	const rows = yield* AccountPreferenceRows.pipe(Effect.provide(AccountPreferenceRows.layer));
	for (const [name, locale] of [
		["alice", "de-DE"],
		["bob", "en-GB"],
	] as const) {
		yield* rows.insertVoid({ id: String(engine.users.get(name)), locale, timezone: "Europe/Berlin", units: "metric" });
	}
});

export const forgottenTable = ownedData.trait(
	"coverage",
	"a table with no repository references the user through a cascading owner_id and a nulling editor_id",
	function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table forgotten (
			id serial primary key,
			owner_id text references "user" (id) on delete cascade,
			editor_id text references "user" (id) on delete set null
		)`;
	},
);

export const authoredNotes = ownedData.trait(
	"coverage",
	"notes name their editor in an editor_id that becomes null when the editor goes",
	function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`alter table notes add column editor_id text references "user" (id) on delete set null`;
	},
);

export const reviewedSettings = ownedData.trait(
	"coverage",
	"account settings are owned by owner_id, and an unmarked reviews table points its reviewer_id at that owner column",
	function* () {
		const sql = yield* SqlClient.SqlClient;
		yield* sql`create table account_settings (owner_id text primary key references "user" (id) on delete cascade, theme text not null)`;
		yield* sql`create table reviews (id serial primary key, reviewer_id text not null references account_settings (owner_id))`;
		yield* ownedModels.accountSettings;
	},
);

export const archivedNotes = ownedData.trait("coverage", "another schema has a notes table referencing the user", function* () {
	const sql = yield* SqlClient.SqlClient;
	yield* sql`create schema archive`;
	yield* sql`create table archive.notes (user_id text references "user" (id) on delete cascade)`;
});

export const mappedUserTable = ownedData.trait("coverage", "auth stores users in members instead of user", function* (engine) {
	yield* mappedExportUser;
	engine.data = accountData({ options: { user: { modelName: "members" } } });
});

export const passedUserReference = ownedData.trait(
	"coverage",
	"auth stores users in members, and the application passes public.members(id) as the user reference",
	function* (engine) {
		yield* mappedExportUser;
		engine.data = accountData({ options: {} }, { column: "id", schema: "public", table: "members" });
	},
);
