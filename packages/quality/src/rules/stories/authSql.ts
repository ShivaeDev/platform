import { Effect, Schema } from "effect";
import { GlobDeclarations, globPatterns, validateGlobs } from "#config/globs.ts";
import { defineRule } from "#rule.ts";
import { authTables } from "#rules/stories/adapters/authTables.ts";
import { sqlTables } from "#rules/stories/adapters/sqlTables.ts";
import { matchesAny } from "#rules/stories/matchesAny.ts";
import { sqlTexts } from "#rules/stories/sqlText.ts";

const AuthSqlOptions = Schema.Struct({
	owners: GlobDeclarations,
});

export const authSql = defineRule({
	check: ({ options, ...inputs }) =>
		Effect.gen(function* () {
			const queries = yield* sqlTexts(inputs);
			function owns(file: string): boolean {
				return matchesAny(file, globPatterns(options.owners));
			}
			const tables = authTables(queries, owns);
			return queries
				.filter((query) => !owns(query.file) && sqlTables(query.text).some((table) => tables.has(table.name) && !table.userReference))
				.map((query) => ({
					file: query.file,
					line: query.line,
					message:
						"SQL accesses a table owned by Better Auth or matching its schema. Use platform's auth API (@shivaedev/identity) for account data; app migrations may only reference user(id) with ON DELETE CASCADE or ON DELETE SET NULL. Only the configured auth-sql owners manage auth storage.",
				}));
		}),
	description: "Apps reference user IDs by foreign key and use identity for account data.",
	id: "boundaries/auth-sql",
	options: Schema.toStandardSchemaV1(AuthSqlOptions, { parseOptions: { errors: "all", onExcessProperty: "error" } }),
	validate: (context) => validateGlobs(context, (file, glob) => matchesAny(file, [glob])),
});
