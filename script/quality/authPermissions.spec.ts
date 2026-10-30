import { expect } from "vitest";
import { authSql } from "@shivaedev/quality/rules/stories/authSql.ts";
import { repositoryHas, ruleKit } from "#quality/test-support/ruleKit.ts";

ruleKit.it(
	"app SQL cannot grant or revoke access to auth tables",
	[
		repositoryHas(
			{
				content: 'sql`GRANT SELECT ON "session" TO app_role`; sql`REVOKE ALL ON "account" FROM app_role`;',
				path: "src/permissions.ts",
			},
			{
				content: 'sql`GRANT SELECT ON TABLE public."verification" TO app_role`; sql`REVOKE ALL ON TABLE public."user" FROM app_role`;',
				path: "src/test-support/permissions.ts",
			},
			{ content: "GRANT SELECT ON notes, public.session TO app_role;", path: "src/grants.sql" },
		),
	],
	function* ({ checks }) {
		const findings = yield* checks(authSql);
		expect(findings.map((finding) => finding.file)).toEqual([
			"src/permissions.ts",
			"src/permissions.ts",
			"src/test-support/permissions.ts",
			"src/test-support/permissions.ts",
			"src/grants.sql",
		]);
	},
);

ruleKit.it(
	"permissions on app tables and other SQL objects do not reach auth storage",
	[
		repositoryHas({
			content: [
				'GRANT SELECT ON orders TO "session", "user";',
				'REVOKE ALL ON TABLE orders FROM "account", "verification";',
				'GRANT USAGE ON SCHEMA "session", "account" TO app_role;',
				'REVOKE USAGE ON SCHEMA "verification" FROM "user";',
				'GRANT EXECUTE ON FUNCTION public."session"(text) TO app_role;',
				'REVOKE EXECUTE ON FUNCTION public."account"() FROM app_role;',
				'CREATE INDEX notes_idx ON notes(id); GRANT USAGE ON SCHEMA "session", "account" TO app_role;',
			].join("\n"),
			path: "src/permissions.sql",
		}),
	],
	function* ({ checks }) {
		expect(yield* checks(authSql)).toEqual([]);
	},
);
