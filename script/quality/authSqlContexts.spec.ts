import { expect } from "vitest";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";
import { authSql } from "#quality-internal/rules/stories/authSql.ts";

ruleKit.it(
	"SQL expressions may read auth-named columns from app tables",
	[
		repositoryHas({
			content: [
				'SELECT extract(epoch FROM "session") FROM notes;',
				'SELECT substring("account" FROM 1 FOR 2) FROM notes;',
				'SELECT trim("verification" FROM "user") FROM notes;',
				'SELECT extract(epoch FROM (SELECT "session" FROM notes)) FROM notes;',
			].join("\n"),
			path: "src/observations.sql",
		}),
	],
	function* ({ checks }) {
		expect(yield* checks(authSql)).toEqual([]);
	},
);

ruleKit.it(
	"ONLY still reaches auth tables when its target is parenthesized",
	[
		repositoryHas(
			{
				content: [
					'sql`SELECT * FROM ONLY (public."user")`;',
					'sql`DELETE FROM ONLY ("session") WHERE expired`;',
					"sql`UPDATE ONLY (public.account) SET token = NULL`;",
				].join("\n"),
				path: "src/users.ts",
			},
			{ content: 'SELECT * FROM ONLY (public."verification");', path: "src/verification.sql" },
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(authSql);
		expect(findings.map((finding) => finding.file)).toEqual(["src/users.ts", "src/users.ts", "src/users.ts", "src/verification.sql"]);
	},
);

ruleKit.it(
	"subqueries inside expressions and derived tables still reach auth storage",
	[
		repositoryHas({
			content: [
				'sql`SELECT (SELECT id FROM "session") FROM notes`;',
				"sql`SELECT extract(epoch FROM (SELECT created_at FROM account)) FROM notes`;",
				"sql`SELECT * FROM (SELECT * FROM verification) AS records`;",
				'sql`SELECT * FROM (notes JOIN public."user" USING (id))`;',
			].join("\n"),
			path: "src/users.ts",
		}),
	],
	function* ({ checks }) {
		const findings = yield* checks(authSql);
		expect(findings.map((finding) => finding.line)).toEqual([1, 2, 3, 4]);
	},
);
