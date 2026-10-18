import { expect } from "vitest";
import sqlInputs from "#quality/test-support/fixtures/story-sql.json" with { type: "json" };
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { authSql } from "#quality-internal/rules/stories/authSql.ts";
import { queueSql } from "#quality-internal/rules/stories/queueSql.ts";

ruleKit.it(
	"an app author cannot purge queues through SQL in source, specs or test-support",
	[
		repositoryHas(
			{ content: "sql`delete from pgboss.job`;", path: "src/jobs.ts" },
			{ content: 'sql.unsafe("truncate table pgboss.queue");', path: "src/jobs.spec.ts" },
			{ content: 'sql`select * from "pgboss"."job"`;', path: "src/test-support/jobs.ts" },
			{ content: "DELETE FROM PGBOSS.job;", path: "src/purge.sql" },
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(queueSql);
		expect(findings.map((finding) => finding.file)).toEqual(["src/jobs.spec.ts", "src/jobs.ts", "src/test-support/jobs.ts", "src/purge.sql"]);
		expect(findings[0]?.message).toContain("no queue-purge API by design");
	},
);

ruleKit.it(
	"an app uses its queue definitions without inspecting queue storage",
	[
		repositoryHas(
			{ content: "yield* WelcomeEmail.enqueue({ userId });", path: "src/jobs.ts" },
			{ content: 'sql`select * from app_jobs`; const source = "sql`delete from pgboss.job`";', path: "src/test-support/jobs.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(queueSql)).toEqual([]);
	},
);

ruleKit.it(
	"queue SQL remains private through interpolation and multiline strings",
	[repositoryHas({ content: sqlInputs.queueInterpolation, path: "src/jobs.ts" })],
	function* ({ checks }) {
		const findings = yield* checks(queueSql);
		expect(findings.map((finding) => finding.line)).toEqual([1, 1, 2]);
	},
);

ruleKit.it(
	"an app author cannot access Better Auth tables through SQL",
	[
		repositoryHas(
			{ content: 'sql`select * from "user"`; sql`update public.account set token = null`;', path: "src/users.ts" },
			{ content: 'sql`delete from "session"`;', path: "src/users.spec.ts" },
			{ content: 'sql.unsafe("truncate verification");', path: "src/test-support/users.ts" },
			{ content: 'ALTER TABLE "user" ADD COLUMN role text;', path: "src/auth.sql" },
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(authSql);
		expect(findings.map((finding) => finding.file)).toEqual([
			"src/test-support/users.ts",
			"src/users.spec.ts",
			"src/users.ts",
			"src/users.ts",
			"src/auth.sql",
		]);
		expect(findings[0]?.message).toContain("Use platform's auth API");
	},
);

ruleKit.it(
	"the auth owner and its migrations can manage auth storage while apps use the auth API",
	[
		repositoryHas(
			{ content: 'sql`select * from "user"`;', path: "platform/auth/adapter.ts" },
			{ content: 'create table "session" (id text);', path: "platform/migrations/0001.sql" },
			{ content: "yield* auth.findUser(userId); sql`select session, account from orders where title = 'user'`;", path: "src/users.ts" },
		),
	],
	function* ({ checks }) {
		expect(yield* checks(authSql, { owners: ["platform/auth/**", "platform/migrations/**"] })).toEqual([]);
	},
);

ruleKit.it(
	"auth ownership does not excuse app SQL and joins reach auth storage too",
	[
		repositoryHas({
			content: sqlInputs.authInterpolation,
			path: "src/users.ts",
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(authSql, { owners: ["platform/auth/**"] });
		expect(findings.map((finding) => finding.line)).toEqual([1, 1]);
	},
);

ruleKit.it(
	"auth storage stays private in comma joins, references and index declarations",
	[
		repositoryHas({
			content:
				'query("select * from notes, public.session"); query("create index email_idx on public.user (email)"); query("alter table notes add foreign key (owner) references account (id)"); db.query({ text: "delete from verification" }); db.prepare("select * from user");',
			path: "src/notes.ts",
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(authSql);
		expect(findings.map((finding) => finding.line)).toEqual([1, 1, 1, 1, 1]);
	},
);
