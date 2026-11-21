import { Effect } from "effect";
import { authMigrationSql, betterAuthMigrationPlan } from "#server/better-auth/adapters/migrationPlan.ts";
import { type AuthSchemaDeclaration, storedRole } from "#server/better-auth/define.ts";

export const generateBetterAuthMigration = Effect.fn("Identity.generateBetterAuthMigration")(function* (auth: AuthSchemaDeclaration) {
	const plan = yield* betterAuthMigrationPlan(auth.options, storedRole(auth));
	const sql = authMigrationSql(plan.ddl).replaceAll("\\", "\\\\").replaceAll("`", "\\`").replaceAll("${", "\\${");
	return `import { Effect } from "effect";\nimport { SqlClient } from "effect/sql";\n\nexport default Effect.gen(function* () {\n\tconst sql = yield* SqlClient.SqlClient;\n\tyield* sql.unsafe(\`${sql}\`);\n});\n`;
});
