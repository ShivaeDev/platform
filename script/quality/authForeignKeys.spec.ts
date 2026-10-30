import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { authSql } from "#quality-internal/rules/stories/authSql.ts";

ruleKit.it(
	"app migrations may reference the auth user id with a deletion policy",
	[
		repositoryHas(
			{
				content: 'sql`create table notes (user_id text references "user" (id) on delete cascade)`;',
				path: "src/migrations/0001_notes.ts",
			},
			{
				content: 'ALTER TABLE notes ADD FOREIGN KEY (user_id) REFERENCES public."user" ("id") ON DELETE SET NULL;',
				path: "src/migrations/0002_owner.sql",
			},
		),
	],
	function* ({ checks }) {
		expect(yield* checks(authSql)).toEqual([]);
	},
);

ruleKit.it(
	"a user foreign key never grants access to auth account data",
	[
		repositoryHas({
			content: 'sql`create table notes (user_id text references "user" (id) on delete cascade)`; sql`SELECT id FROM "user"`;',
			path: "src/migrations/0001_notes.ts",
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(authSql);
		expect(findings.map(({ file }) => file)).toEqual(["src/migrations/0001_notes.ts"]);
		expect(findings[0]?.message).toContain("Use platform's auth API");
	},
);

for (const reference of [
	'"user" (email) on delete cascade',
	'"user" (id, email) on delete cascade',
	'"user" (id)',
	'"user" (id) on delete restrict',
	'"user" (id) on delete no action',
	'"account" (id) on delete cascade',
	'"session" (id) on delete set null',
	'"verification" (id) on delete cascade',
]) {
	ruleKit.it(
		`app migrations cannot reference ${reference}`,
		[repositoryHas({ content: `create table notes (user_id text references ${reference});`, path: "src/migrations/0001_notes.sql" })],
		function* ({ checks }) {
			expect((yield* checks(authSql)).map(({ file }) => file)).toEqual(["src/migrations/0001_notes.sql"]);
		},
	);
}
